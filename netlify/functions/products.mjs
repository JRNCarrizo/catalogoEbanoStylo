import { isAuthenticated, jsonResponse } from "./_auth.mjs";

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
  if (!["standard", "landscape", "square", "portrait"].includes(product.imageLayout)) return "Invalid image layout";
  return null;
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
    const rows = await databaseRequest(config, `products?id=eq.${encodeURIComponent(body.id)}`, {
      method,
      headers: { Prefer: "return=representation" },
      ...(method === "PATCH" ? { body: JSON.stringify(toRow(body)) } : {}),
    });
    if (!rows.length) return jsonResponse(404, { error: "Product not found" });
    return jsonResponse(200, method === "PATCH" ? toProduct(rows[0]) : { ok: true });
  } catch {
    return jsonResponse(502, { error: "Could not update the product" });
  }
};
