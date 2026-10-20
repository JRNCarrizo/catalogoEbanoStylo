import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "ebano_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSessionCookie(username, secret) {
  const payload = Buffer.from(JSON.stringify({ username, expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000 })).toString("base64url");
  const token = `${payload}.${sign(payload, secret)}`;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DURATION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function isAuthenticated(event, secret = process.env.SESSION_SECRET) {
  if (!secret) return false;
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || "";
  const token = cookieHeader.split(";").map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof session.username === "string" && session.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export function jsonResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
    body: JSON.stringify(body),
  };
}