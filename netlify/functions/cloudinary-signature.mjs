import { createHash } from "node:crypto";
import { isAuthenticated, jsonResponse } from "./_auth.mjs";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" }, { Allow: "POST" });
  if (!isAuthenticated(event)) return jsonResponse(401, { error: "Unauthorized" });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return jsonResponse(503, { error: "Cloudinary is not configured" });

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = process.env.CLOUDINARY_FOLDER || "catalogo-ebano/productos";
  const signaturePayload = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash("sha1").update(signaturePayload).digest("hex");

  return jsonResponse(200, { cloudName, apiKey, folder, timestamp, signature });
};