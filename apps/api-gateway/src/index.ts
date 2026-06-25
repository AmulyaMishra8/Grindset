import "dotenv/config";
import fs from "fs";
import path from "path";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;

// Serve the built SPA from this same origin so the API and frontend share one
// host — that keeps auth cookies first-party (works in Brave/Safari, no
// third-party-cookie blocking). dist lives at apps/web/dist.
const WEB_DIST = path.join(__dirname, "..", "..", "web", "dist");

const USER_SERVICE_URL  = process.env.USER_SERVICE_URL  ?? "http://localhost:4001";
const JUDGE_SERVICE_URL = process.env.JUDGE_SERVICE_URL ?? "http://localhost:4002";
const AUTH_SERVICE_URL  = process.env.AUTH_SERVICE_URL  ?? "http://localhost:4003";

app.use(
  createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathFilter: "/api/users",
  })
);

app.use(
  createProxyMiddleware({
    target: JUDGE_SERVICE_URL,
    changeOrigin: true,
    pathFilter: "/api/judge",
  })
);

app.use(
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathFilter: ["/auth", "/mfa", "/oauth", "/.well-known", "/api/discuss"],
  })
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Static assets, then SPA fallback so client-side routes (/login, /problems…)
// resolve to index.html. Registered after the API proxies so they win. Only
// wired up if the web build is present, so a backend-only deploy still serves
// the API instead of 500-ing every page.
const indexHtml = path.join(WEB_DIST, "index.html");
if (fs.existsSync(indexHtml)) {
  app.use(express.static(WEB_DIST));
  app.get("*", (_req, res) => res.sendFile(indexHtml));
} else {
  console.warn(`[gateway] web build not found at ${WEB_DIST} — serving API only`);
}

app.listen(PORT, () => {
  console.log(`API Gateway running on http://localhost:${PORT}`);
});
