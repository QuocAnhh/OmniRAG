import crypto from "node:crypto";

export function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function signBody(secret, body) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}
