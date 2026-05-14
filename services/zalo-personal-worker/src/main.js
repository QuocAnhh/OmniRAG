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

app.post("/bots/:bot_id/login/start", { preHandler: requireBearer }, async (request) => {
  const { bot_id: botId } = request.params;
  const body = request.body || {};
  const status = await manager.startQrLogin(botId, {
    replyPolicy: body.reply_policy || "mention_only",
    threadWhitelist: body.thread_whitelist || [],
    userAgent: body.user_agent,
  });
  return { ok: true, status };
});

app.get("/bots/:bot_id/login/status", { preHandler: requireBearer }, async (request) => {
  const { bot_id: botId } = request.params;
  const session = manager.get(botId);
  return { ok: true, status: session ? manager.publicStatus(session) : manager.defaultStatus(botId) };
});

app.get("/bots/:bot_id/status", { preHandler: requireBearer }, async (request) => {
  const { bot_id: botId } = request.params;
  const session = manager.get(botId);
  return { ok: true, status: session ? manager.publicStatus(session) : manager.defaultStatus(botId) };
});

app.post("/bots/:bot_id/send", { preHandler: requireBearer }, async (request, reply) => {
  const { bot_id: botId } = request.params;
  const { thread_id: threadId, text, thread_type: threadType = "user" } = request.body || {};
  if (!threadId || !text) {
    reply.code(400).send({ error: "thread_id and text are required" });
    return;
  }
  return manager.send(botId, threadId, text, threadType);
});

app.post("/bots/:bot_id/unload", { preHandler: requireBearer }, async (request) => {
  const { bot_id: botId } = request.params;
  const removed = await manager.unload(botId);
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
