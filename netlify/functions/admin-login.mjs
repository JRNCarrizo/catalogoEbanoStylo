import { timingSafeEqual } from "node:crypto";
import { createSessionCookie, jsonResponse } from "./_auth.mjs";

function matches(value, expected) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" }, { Allow: "POST" });

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!username || !password || !sessionSecret) return jsonResponse(503, { error: "Admin authentication is not configured" });

  let credentials;
  try {
    credentials = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid request" });
  }

  if (typeof credentials.username !== "string" || typeof credentials.password !== "string"
    || !matches(credentials.username, username) || !matches(credentials.password, password)) {
    return jsonResponse(401, { error: "Invalid credentials" });
  }

  return jsonResponse(200, { ok: true }, { "Set-Cookie": createSessionCookie(username, sessionSecret) });
};