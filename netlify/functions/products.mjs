import { isAuthenticated, jsonResponse } from "./_auth.mjs";
import { createHash } from "node:crypto";

function getDatabaseConfig() {
  const projectUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  const apiKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!projectUrl || !apiKey) return null;
  return { projectUrl, apiKey };
}

function toProduct(row) {
  return {
    id: row.id,
    name: row.name,
    section: row.section,
    description: row.description,
    details: row.details,
    price: Number(row.price),
    previousPrice: row.previous_price === null ? null : Number(row.previous_price),
    showPrice: row.show_price,
    image: row.image,
    images: row.images,
    imagePublicIds: row.image_public_ids || [],
    tag: row.tag,
    imageLayout: row.image_layout,
  };
}

function toRow(product) {
  return {
    id: product.id,
    name: product.name,
    section: product.section,
    description: product.description,
    details: product.details,
    price: product.price,
    previous_price: product.previousPrice,
    show_price: product.showPrice,
    image: product.image,
    images: product.images,
    image_public_ids: product.imagePublicIds || product.images.map(() => ""),
    tag: product.tag,
    image_layout: product.imageLayout,
  };
}

function validateProduct(product, requireId = true) {
  if (!product || typeof product !== "object" || Array.isArray(product)) return "Invalid product";
  if (requireId && (typeof product.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(product.id))) return "Invalid product ID";
  if (typeof product.name !== "string" || !product.name.trim() || product.name.length > 200) return "Product name is required";
  if (typeof product.section !== "string" || !product.section.trim() || product.section.length > 100) return "Product section is required";
  if (typeof product.description !== "string" || typeof product.details !== "string") return "Invalid product description";
  if (typeof product.price !== "number" || !Number.isFinite(product.price) || product.price < 0) return "Invalid product price";
  if (product.previousPrice !== null && (typeof product.previousPrice !== "number" || !Number.isFinite(product.previousPrice) || product.previousPrice < 0)) return "Invalid previous price";
  if (typeof product.showPrice !== "boolean" || typeof product.image !== "string" || typeof product.tag !== "string") return "Invalid product fields";
  if (product.image && !product.image.startsWith("https://")) return "Invalid product image";
  if (!Array.isArray(product.images) || product.images.length > 5
    || product.images.some((image) => typeof image !== "string" || !image.startsWith("https://"))) return "Invalid product images";
  if (!product.images.length && product.image) return "Invalid product images";
  if (product.imagePublicIds !== undefined
    && (!Array.isArray(product.imagePublicIds)
      || product.imagePublicIds.length !== product.images.length
      || product.imagePublicIds.some((publicId) => typeof publicId !== "string"))) return "Invalid product image IDs";
  if (!["standard", "landscape", "square", "portrait"].includes(product.imageLayout)) return "Invalid image layout";
  return null;
}

async function deleteCloudinaryImages(publicIds) {
  const ids = [...new Set(publicIds.filter((publicId) => typeof publicId === "string" && publicId))];
  if (!ids.length) return false;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Cloudinary image cleanup skipped because Cloudinary is not configured");
    return true;
  }

  const results = await Promise.all(ids.map(async (publicId) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash("sha1")
      .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");
    const body = new URLSearchParams({ public_id: publicId, api_key: apiKey, timestamp: String(timestamp), signature });
    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const result = await response.json();
      if (!response.ok || !["ok", "not found"].includes(result.result)) {
        console.error("Cloudinary image deletion failed", response.status, result.error?.message || result.result);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Cloudinary image deletion request failed", error);
      return false;
    }
  }));
  return results.some((result) => !result);
}

async function databaseRequest(config, path, options = {}) {
  const headers = {
    apikey: config.apiKey,
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (config.apiKey.startsWith("eyJ")) headers.Authorization = `Bearer ${config.apiKey}`;

  const response = await fetch(`${config.projectUrl}/rest/v1/${path}`, {
    ...options,
    headers,
  });
  const body = await response.text();
  if (!response.ok) {
    console.error("Supabase request failed", response.status, body);
    throw new Error("Database request failed");
  }
  return body ? JSON.parse(body) : [];
}

export const handler = async (event) => {
  const method = event.httpMethod;
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
    return jsonResponse(405, { error: "Method not allowed" }, { Allow: "GET, POST, PATCH, DELETE" });
  }
  if (method !== "GET" && !isAuthenticated(event)) return jsonResponse(401, { error: "Unauthorized" });

  const config = getDatabaseConfig();
  if (!config) return jsonResponse(503, { error: "Supabase is not configured" });

  if (method === "GET") {
    try {
      const rows = await databaseRequest(config, "products?select=*&order=created_at.asc");
      return jsonResponse(200, rows.map(toProduct));
    } catch {
      return jsonResponse(502, { error: "Could not load products from the database" });
    }
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid request body" });
  }

  if (method === "POST") {
    const error = validateProduct(body);
    if (error) return jsonResponse(400, { error });
    try {
      const rows = await databaseRequest(config, "products", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(toRow(body)),
      });
      return jsonResponse(201, toProduct(rows[0]));
    } catch {
      return jsonResponse(502, { error: "Could not save the product" });
    }
  }

  if (typeof body.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.id)) {
    return jsonResponse(400, { error: "Invalid product ID" });
  }

  if (method === "PATCH") {
    const error = validateProduct(body);
    if (error) return jsonResponse(400, { error });
  }

  try {
    if (method === "PATCH") {
      const existing = await databaseRequest(config, `products?id=eq.${encodeURIComponent(body.id)}&select=id,image_public_ids`);
      if (!existing.length) return jsonResponse(404, { error: "Product not found" });
      const rows = await databaseRequest(config, `products?id=eq.${encodeURIComponent(body.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(toRow(body)),
      });
      if (!rows.length) return jsonResponse(404, { error: "Product not found" });
      const retainedIds = new Set(body.imagePublicIds || []);
      const removedIds = (existing[0].image_public_ids || []).filter((publicId) => publicId && !retainedIds.has(publicId));
      const cleanupWarning = await deleteCloudinaryImages(removedIds);
      return jsonResponse(200, { ...toProduct(rows[0]), cleanupWarning });
    }

    const rows = await databaseRequest(config, `products?id=eq.${encodeURIComponent(body.id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    });
    if (!rows.length) return jsonResponse(404, { error: "Product not found" });
    const cleanupWarning = await deleteCloudinaryImages(rows[0].image_public_ids || []);
    return jsonResponse(200, { ok: true, cleanupWarning });
  } catch {
    return jsonResponse(502, { error: "Could not update the product" });
  }
};
