import Fastify from "fastify";
import { settings } from "./config.js";
import { manager } from "./manager.js";
import { timingSafeEqualText } from "./security.js";

const app = Fastify({ logger: { level: settings.logLevel } });

function requireBearer(request, reply, done) {
  if (!settings.workerApiToken) {
    reply.code(503).send({ error: "worker not configured" });
    return;
  }

  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    reply.code(401).send({ error: "missing bearer token" });
    return;
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!timingSafeEqualText(token, settings.workerApiToken)) {
    reply.code(403).send({ error: "invalid token" });
    return;
  }

  done();
}

app.get("/health", async () => ({
  ok: true,
  loaded_bots: manager.sessions.size,
}));

// ── New routes (accountId-based) ────────────────────────────────────────

app.post("/accounts/:account_id/login/start", { preHandler: requireBearer }, async (request) => {
  const { account_id: accountId } = request.params;
  const body = request.body || {};
  const status = await manager.startQrLogin(accountId, body.bot_id, {
    replyPolicy: body.reply_policy || "mention_only",
    threadWhitelist: body.thread_whitelist || [],
    userAgent: body.user_agent,
  });
  return { ok: true, status };
});

app.get("/accounts/:account_id/login/status", { preHandler: requireBearer }, async (request) => {
  const { account_id: accountId } = request.params;
  const session = manager.get(accountId);
  return { ok: true, status: session ? manager.publicStatus(session) : manager.defaultStatus(accountId) };
});

app.get("/accounts/:account_id/status", { preHandler: requireBearer }, async (request) => {
  const { account_id: accountId } = request.params;
  const session = manager.get(accountId);
  return { ok: true, status: session ? manager.publicStatus(session) : manager.defaultStatus(accountId) };
});

app.post("/accounts/:account_id/typing", { preHandler: requireBearer }, async (request, reply) => {
  const { account_id: accountId } = request.params;
  const { thread_id: threadId, thread_type: threadType = "user" } = request.body || {};
  if (!threadId) {
    reply.code(400).send({ error: "thread_id is required" });
    return;
  }
  return manager.sendTyping(accountId, threadId, threadType);
});

app.post("/accounts/:account_id/send", { preHandler: requireBearer }, async (request, reply) => {
  const { account_id: accountId } = request.params;
  const { thread_id: threadId, text, thread_type: threadType = "user" } = request.body || {};
  if (!threadId || !text) {
    reply.code(400).send({ error: "thread_id and text are required" });
    return;
  }
  return manager.send(accountId, threadId, text, threadType);
});

app.post("/accounts/:account_id/unload", { preHandler: requireBearer }, async (request) => {
  const { account_id: accountId } = request.params;
  const removed = await manager.unload(accountId);
  return { ok: true, removed };
});

// ── Legacy routes (botId-based, backward compat for single-account bots) ──

app.post("/bots/:bot_id/login/start", { preHandler: requireBearer }, async (request) => {
  const { bot_id: botId } = request.params;
  const body = request.body || {};
  // Legacy: use botId as accountId
  const status = await manager.startQrLogin(botId, botId, {
    replyPolicy: body.reply_policy || "mention_only",
    threadWhitelist: body.thread_whitelist || [],
    userAgent: body.user_agent,
  });
  return { ok: true, status };
});

app.get("/bots/:bot_id/login/status", { preHandler: requireBearer }, async (request) => {
  const { bot_id: botId } = request.params;
  const session = manager.get(botId) || manager.getByBotId(botId);
  return { ok: true, status: session ? manager.publicStatus(session) : manager.defaultStatus(botId) };
});

app.get("/bots/:bot_id/status", { preHandler: requireBearer }, async (request) => {
  const { bot_id: botId } = request.params;
  const session = manager.get(botId) || manager.getByBotId(botId);
  return { ok: true, status: session ? manager.publicStatus(session) : manager.defaultStatus(botId) };
});

app.post("/bots/:bot_id/typing", { preHandler: requireBearer }, async (request, reply) => {
  const { bot_id: botId } = request.params;
  const { thread_id: threadId, thread_type: threadType = "user" } = request.body || {};
  if (!threadId) {
    reply.code(400).send({ error: "thread_id is required" });
    return;
  }
  const session = manager.get(botId) || manager.getByBotId(botId);
  const accountId = session ? session.accountId : botId;
  return manager.sendTyping(accountId, threadId, threadType);
});

app.post("/bots/:bot_id/send", { preHandler: requireBearer }, async (request, reply) => {
  const { bot_id: botId } = request.params;
  const { thread_id: threadId, text, thread_type: threadType = "user" } = request.body || {};
  if (!threadId || !text) {
    reply.code(400).send({ error: "thread_id and text are required" });
    return;
  }
  const session = manager.get(botId) || manager.getByBotId(botId);
  const accountId = session ? session.accountId : botId;
  return manager.send(accountId, threadId, text, threadType);
});

app.post("/bots/:bot_id/unload", { preHandler: requireBearer }, async (request) => {
  const { bot_id: botId } = request.params;
  const session = manager.get(botId) || manager.getByBotId(botId);
  const accountId = session ? session.accountId : botId;
  const removed = await manager.unload(accountId);
  return { ok: true, removed };
});

const close = async () => {
  app.log.info("zalo-personal-worker shutting down");
  await manager.stopAll();
  await app.close();
};

process.on("SIGTERM", () => void close());
process.on("SIGINT", () => void close());

await manager.autoLoadSavedSessions();
await app.listen({ host: settings.host, port: settings.port });
