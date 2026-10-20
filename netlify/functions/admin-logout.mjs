import { clearSessionCookie, jsonResponse } from "./_auth.mjs";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" }, { Allow: "POST" });
  return jsonResponse(200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
};