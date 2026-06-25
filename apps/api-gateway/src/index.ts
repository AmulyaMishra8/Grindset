import "dotenv/config";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;

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
    pathFilter: ["/auth", "/mfa", "/oauth", "/.well-known"],
  })
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on http://localhost:${PORT}`);
});
