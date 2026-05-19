import fs from "node:fs/promises";
import path from "node:path";
import { Zalo, ThreadType, LoginQRCallbackEventType, CloseReason } from "zca-js";
import { settings } from "./config.js";
import { shouldAcceptMessage } from "./policy.js";
import { signBody } from "./security.js";
import { checkLimits, recordSend, getDailyCount } from "./rate-limiter.js";
import {
  recordDisconnect, resetAll, isDisconnectTripped,
  recordBackendFailure, recordBackendSuccess, isBackendDown,
} from "./circuit-breaker.js";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";

function nowIso() {
  return new Date().toISOString();
}

function safeError(error) {
  if (!error) return "";
  return `${error.name || "Error"}: ${error.message || String(error)}`;
}

function threadTypeName(type) {
  return type === ThreadType.Group ? "group" : "user";
}

export class ZaloPersonalManager {
  constructor({ zaloFactory = () => new Zalo({ logging: false }), fetchImpl = globalThis.fetch } = {}) {
    this.zaloFactory = zaloFactory;
    this.fetch = fetchImpl;
    this.sessions = new Map();
  }

  async ensureSessionsDir() {
    await fs.mkdir(settings.sessionsDir, { recursive: true });
  }

  sessionPath(botId) {
    return path.join(settings.sessionsDir, `${botId}.json`);
  }

  defaultStatus(botId) {
    return {
      bot_id: botId,
      status: "disconnected",
      uid: "",
      name: "",
      loaded: false,
      listener_connected: false,
      qr_image: null,
      qr_generated_at: null,
      connected_at: null,
      last_event_at: null,
      last_error: null,
      error_count: 0,
      reply_policy: "mention_only",
      thread_whitelist: [],
    };
  }

  publicStatus(session) {
    if (!session) return null;
    return {
      ...session.status,
      has_credentials: Boolean(session.credentials),
      rate_limit: {
        daily_count: getDailyCount(session.botId),
        daily_limit: 200,
      },
      circuit_breaker: {
        disconnect_tripped: isDisconnectTripped(session.botId),
        backend_down: isBackendDown(session.botId),
      },
    };
  }

  get(botId) {
    return this.sessions.get(botId) || null;
  }

  getOrCreate(botId) {
    let session = this.sessions.get(botId);
    if (!session) {
      session = {
        botId,
        api: null,
        credentials: null,
        loginPromise: null,
        options: {
          replyPolicy: "mention_only",
          threadWhitelist: [],
        },
        status: this.defaultStatus(botId),
      };
      this.sessions.set(botId, session);
    }
    return session;
  }

  async saveCredentials(botId, credentials) {
    await this.ensureSessionsDir();
    const file = this.sessionPath(botId);
    await fs.writeFile(file, JSON.stringify(credentials, null, 2), { mode: 0o600 });
    await fs.chmod(file, 0o600);
  }

  async deleteCredentials(botId) {
    try {
      await fs.unlink(this.sessionPath(botId));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  async loadCredentials(botId) {
    const raw = await fs.readFile(this.sessionPath(botId), "utf-8");
    const credentials = JSON.parse(raw);
    if (!credentials?.cookie || !credentials?.imei || !credentials?.userAgent) {
      throw new Error("saved credentials are incomplete");
    }
    return credentials;
  }

  async autoLoadSavedSessions() {
    await this.ensureSessionsDir();
    const files = await fs.readdir(settings.sessionsDir).catch(() => []);
    await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          const botId = file.slice(0, -5);
          try {
            const credentials = await this.loadCredentials(botId);
            const session = this.getOrCreate(botId);
            session.credentials = credentials;
            await this.loginWithCredentials(botId, credentials, session.options);
          } catch (error) {
            const session = this.getOrCreate(botId);
            session.status.status = "relogin_required";
            session.status.last_error = safeError(error);
            session.status.error_count += 1;
          }
        }),
    );
  }

  async loginWithCredentials(botId, credentials, options = {}) {
    const session = this.getOrCreate(botId);
    session.options = {
      replyPolicy: options.replyPolicy || session.options.replyPolicy || "mention_only",
      threadWhitelist: options.threadWhitelist || session.options.threadWhitelist || [],
    };
    resetAll(botId);

    session.status.reply_policy = session.options.replyPolicy;
    session.status.thread_whitelist = session.options.threadWhitelist;
    session.status.status = "connecting";
    session.status.last_error = null;

    const zalo = this.zaloFactory();
    try {
      const api = await zalo.login(credentials);
      session.credentials = credentials;
      await this.attachApi(session, api);
      return this.publicStatus(session);
    } catch (error) {
      session.status.status = "relogin_required";
      session.status.loaded = false;
      session.status.listener_connected = false;
      session.status.last_error = safeError(error);
      session.status.error_count += 1;
      throw error;
    }
  }

  async startQrLogin(botId, options = {}) {
    const session = this.getOrCreate(botId);
    session.options = {
      replyPolicy: options.replyPolicy || "mention_only",
      threadWhitelist: options.threadWhitelist || [],
    };
    session.status = {
      ...this.defaultStatus(botId),
      status: "connecting",
      reply_policy: session.options.replyPolicy,
      thread_whitelist: session.options.threadWhitelist,
    };

    resetAll(botId);

    if (session.api?.listener) {
      session.api.listener.stop();
      session.api = null;
    }

    const userAgent = options.userAgent || DEFAULT_USER_AGENT;
    const zalo = this.zaloFactory();

    session.loginPromise = (async () => {
      let loginCredentials = null;
      try {
        const api = await zalo.loginQR({ userAgent, language: "vi" }, (event) => {
          switch (event.type) {
            case LoginQRCallbackEventType.QRCodeGenerated:
              session.status.status = "qr_ready";
              session.status.qr_image = event.data?.image || null;
              session.status.qr_generated_at = nowIso();
              session.status.last_error = null;
              break;
            case LoginQRCallbackEventType.QRCodeScanned:
              session.status.status = "scanned";
              break;
            case LoginQRCallbackEventType.QRCodeExpired:
              session.status.status = "expired";
              session.status.last_error = "QR code expired";
              break;
            case LoginQRCallbackEventType.QRCodeDeclined:
              session.status.status = "error";
              session.status.last_error = "QR login declined";
              break;
            case LoginQRCallbackEventType.GotLoginInfo:
              loginCredentials = {
                cookie: event.data.cookie,
                imei: event.data.imei,
                userAgent: event.data.userAgent,
                language: "vi",
              };
              break;
            default:
              break;
          }
        });

        if (!loginCredentials && api.getContext) {
          const ctx = api.getContext();
          loginCredentials = {
            cookie: ctx.cookie.toJSON()?.cookies || [],
            imei: ctx.imei,
            userAgent: ctx.userAgent,
            language: ctx.language || "vi",
          };
        }

        if (!loginCredentials) {
          throw new Error("login completed without credentials");
        }

        await this.saveCredentials(botId, loginCredentials);
        session.credentials = loginCredentials;
        await this.attachApi(session, api);
      } catch (error) {
        session.status.status = session.status.status === "expired" ? "expired" : "error";
        session.status.loaded = false;
        session.status.listener_connected = false;
        session.status.last_error = safeError(error);
        session.status.error_count += 1;
      } finally {
        session.loginPromise = null;
      }
    })();

    return this.publicStatus(session);
  }

  async attachApi(session, api) {
    session.api = api;
    session.status.loaded = true;
    session.status.status = "connected";
    session.status.listener_connected = false;
    session.status.connected_at = session.status.connected_at || nowIso();
    session.status.qr_image = null;
    session.status.last_error = null;

    try {
      const account = await api.fetchAccountInfo();
      session.status.uid = String(account?.profile?.userId || account?.profile?.uid || "");
      session.status.name = String(account?.profile?.displayName || account?.profile?.zaloName || "");
    } catch (error) {
      session.status.last_error = safeError(error);
    }

    api.listener.on("connected", () => {
      session.status.listener_connected = true;
      session.status.status = "connected";
      session.status.last_error = null;
    });

    api.listener.on("closed", (code, reason) => {
      session.status.listener_connected = false;
      session.status.status =
        code === CloseReason.DuplicateConnection ? "duplicate_connection" : "disconnected";
      session.status.last_error = reason || `listener closed with code ${code}`;

      const { tripped, reason: tripReason } = recordDisconnect(botId);
      if (tripped) {
        session.status.status = "relogin_required";
        session.status.last_error = tripReason;
        this.postInbound(botId, {
          kind: "status_change",
          bot_id: botId,
          data: { status: "relogin_required", reason: tripReason },
        }).catch(() => {});
      }
    });

    api.listener.on("error", (error) => {
      session.status.last_error = safeError(error);
      session.status.error_count += 1;
    });

    api.listener.on("message", (message) => {
      void this.handleMessage(session, message).catch((error) => {
        session.status.last_error = safeError(error);
        session.status.error_count += 1;
      });
    });

    api.listener.start({ retryOnClose: true });
  }

  async handleMessage(session, message) {
    const decision = shouldAcceptMessage(message, session.status, session.options);
    if (!decision.accept) return;

    session.status.last_event_at = nowIso();
    const data = {
      thread_id: String(message.threadId),
      thread_type: threadTypeName(message.type),
      sender_id: String(message.data?.uidFrom || ""),
      sender_name: String(message.data?.dName || ""),
      text: decision.text,
      message_id: String(message.data?.msgId || message.data?.cliMsgId || ""),
      is_group: decision.isGroup,
      raw: message.data || {},
    };

    await this.postInbound(session.botId, {
      kind: "message",
      bot_id: session.botId,
      data,
    });
  }

  async postInbound(botId, payload) {
    if (isBackendDown(botId) && payload.kind === "message") {
      return;
    }

    if (!settings.inboundSecret) {
      throw new Error("INBOUND_SECRET is not configured");
    }
    const body = JSON.stringify(payload);
    const signature = signBody(settings.inboundSecret, body);
    const response = await this.fetch(
      `${settings.backendUrl}/api/v1/channels/zalo-personal/inbound/${botId}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-zalo-personal-signature": signature,
        },
        body,
      },
    );
    if (!response.ok) {
      const tripped = recordBackendFailure(botId);
      if (tripped) {
        const session = this.get(botId);
        if (session) {
          session.status.status = "backend_down";
          session.status.last_error = "backend unreachable — paused";
        }
      }
      throw new Error(`backend inbound failed: ${response.status} ${await response.text()}`);
    }

    recordBackendSuccess(botId);
    const session = this.get(botId);
    if (session && session.status.status === "backend_down") {
      session.status.status = "connected";
      session.status.last_error = null;
    }
  }

  async send(botId, threadId, text, threadType = "user") {
    const session = this.get(botId);
    if (!session?.api) {
      throw new Error("bot session is not loaded");
    }
    const { allowed, reason } = checkLimits(botId);
    if (!allowed) {
      throw new Error(`rate_limited: ${reason}`);
    }
    const zcaThreadType = threadType === "group" ? ThreadType.Group : ThreadType.User;
    const result = await session.api.sendMessage({ msg: text }, String(threadId), zcaThreadType);
    recordSend(botId);
    return { ok: true, result };
  }

  async unload(botId, { deleteSession = true } = {}) {
    const session = this.get(botId);
    if (!session) return false;
    if (session.api?.listener) {
      session.api.listener.stop();
    }
    if (deleteSession) {
      await this.deleteCredentials(botId);
    }
    this.sessions.delete(botId);
    return true;
  }

  async stopAll() {
    await Promise.all([...this.sessions.keys()].map((botId) => this.unload(botId, { deleteSession: false })));
  }
}

export const manager = new ZaloPersonalManager();
