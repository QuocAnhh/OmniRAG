export const settings = {
  port: Number(process.env.PORT || 9200),
  host: process.env.HOST || "0.0.0.0",
  backendUrl: (process.env.BACKEND_URL || "http://backend:8000").replace(/\/+$/, ""),
  workerApiToken: process.env.WORKER_API_TOKEN || process.env.ZALO_PERSONAL_WORKER_API_TOKEN || "",
  inboundSecret: process.env.INBOUND_SECRET || process.env.ZALO_PERSONAL_INBOUND_SECRET || "",
  sessionsDir: process.env.SESSIONS_DIR || "/sessions",
  logLevel: process.env.LOG_LEVEL || "info",
  rateLimitDaily: Number(process.env.RATE_LIMIT_DAILY || 200),
  rateLimitBurst: Number(process.env.RATE_LIMIT_BURST || 5),
  disconnectThreshold: Number(process.env.DISCONNECT_THRESHOLD || 5),
  backendFailureThreshold: Number(process.env.BACKEND_FAILURE_THRESHOLD || 10),
};
