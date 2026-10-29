import { resolve, sep } from "node:path";

const port = Number(Bun.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const baseUrl = getBaseUrl();
const publicRoot = Bun.env.PUBLIC_DIR ? resolve(Bun.env.PUBLIC_DIR) : null;
const links = new Map();
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function getBaseUrl() {
  const configured = Bun.env.BASE_URL
    || (Bun.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${Bun.env.RAILWAY_PUBLIC_DOMAIN}`
      : `http://localhost:${port}`);

  try {
    return new URL(configured).origin;
  } catch {
    throw new Error("BASE_URL must be a valid URL origin");
  }
}

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra,
  };
}

function jsonResponse(data, status = 200) {
  return Response.json(data, { status, headers: corsHeaders() });
}

function createCode() {
  let code = "";
  const bytes = new Uint8Array(16);

  while (code.length < 6) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < 248) code += alphabet[byte % alphabet.length];
      if (code.length === 6) break;
    }
  }

  return code;
}

function createUniqueCode() {
  let code;
  do {
    code = createCode();
  } while (links.has(code));
  return code;
}

async function serveStatic(pathname) {
  if (!publicRoot) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relativePath = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = resolve(publicRoot, `.${relativePath}`);
  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${sep}`)) {
    return null;
  }

  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;

  return new Response(file, { headers: corsHeaders() });
}

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method === "POST" && pathname === "/api/links") {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON" }, 400);
      }

      if (!body || typeof body.url !== "string") {
        return jsonResponse({ error: "A URL is required" }, 400);
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(body.url);
      } catch {
        return jsonResponse({ error: "A valid HTTP or HTTPS URL is required" }, 400);
      }

      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return jsonResponse({ error: "Only HTTP and HTTPS URLs are allowed" }, 400);
      }

      const code = createUniqueCode();
      const link = {
        code,
        url: parsedUrl.href,
        shortUrl: `${baseUrl}/${code}`,
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      links.set(code, link);
      return jsonResponse(link, 201);
    }

    if (request.method === "GET" && pathname === "/api/links") {
      return jsonResponse(Array.from(links.values()));
    }

    if (request.method === "GET") {
      const staticResponse = await serveStatic(pathname);
      if (staticResponse) return staticResponse;

      const match = pathname.match(/^\/([^/]+)$/);
      if (match) {
        let code;
        try {
          code = decodeURIComponent(match[1]);
        } catch {
          return jsonResponse({ error: "Not found" }, 404);
        }

        const link = links.get(code);
        if (!link) return jsonResponse({ error: "Not found" }, 404);

        link.hits += 1;
        return new Response(null, {
          status: 302,
          headers: corsHeaders({ Location: link.url }),
        });
      }
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
});

console.log(`Snip backend listening on ${server.url}`);