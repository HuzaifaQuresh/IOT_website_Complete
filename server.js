import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const CLIENT_DIR = path.join(__dirname, "dist", "client");

// Import the compiled TanStack Start fetch handler
let handler;
try {
  const serverModule = await import("./dist/server/server.js");
  handler = serverModule.default;
} catch (err) {
  console.error("Failed to load production server module:", err);
}

// Mime types helper for static files
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

http
  .createServer(async (req, res) => {
    // 1. Try to serve from dist/client/
    const decodedPath = decodeURIComponent(req.url.split("?")[0]);
    const filePath = path.join(CLIENT_DIR, decodedPath);

    try {
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable",
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    } catch (e) {
      // File not found in client folder, fall back to SSR handler
    }

    if (!handler) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server not initialized");
      return;
    }

    try {
      // 2. Fall back to SSR / TanStack Start fetch handler
      const url = `http://${req.headers.host || "localhost"}${req.url}`;
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else if (value !== undefined) {
          headers.append(key, value);
        }
      }

      let body = null;
      if (req.method !== "GET" && req.method !== "HEAD") {
        body = Readable.toWeb(req);
      }

      const webReq = new Request(url, {
        method: req.method,
        headers,
        body,
        // @ts-ignore
        duplex: "half",
      });

      const webRes = await handler.fetch(webReq);

      // Copy status and headers
      res.statusCode = webRes.status;
      webRes.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      if (webRes.body) {
        const reader = webRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    } catch (err) {
      console.error("SSR error:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  })
  .listen(PORT, "0.0.0.0", () => {
    console.log(`Production server running on http://localhost:${PORT}`);
  });
