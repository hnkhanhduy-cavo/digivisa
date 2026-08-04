import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add bodyParser for any potential JSON payloads
  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const API_TARGET = process.env.API_PROXY_TARGET || "http://127.0.0.1:8788";

  app.use("/api", async (req, res, next) => {
    if (req.path === "/health") return next();

    const targetUrl = API_TARGET + "/api" + req.url;

    const headers: Record<string, string> = {};
    if (req.headers["content-type"]) {
      headers["content-type"] = req.headers["content-type"] as string;
    }
    if (req.headers["x-sync-secret"]) {
      headers["x-sync-secret"] = req.headers["x-sync-secret"] as string;
    }

    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const body = hasBody && req.body !== undefined ? JSON.stringify(req.body) : undefined;

    try {
      const upstream = await fetch(targetUrl, {
        method: req.method,
        headers,
        body,
      });

      const responseText = await upstream.text();
      const contentType = upstream.headers.get("content-type");
      if (contentType) {
        res.setHeader("content-type", contentType);
      }
      return res.status(upstream.status).send(responseText);
    } catch (err) {
      return res.status(502).json({
        success: false,
        error: "API dev server chưa chạy. Mở terminal khác và chạy: npm run dev:api",
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
