// Runs all backend services as child processes inside a single Render service.
// The gateway binds Render's $PORT and proxies to the others over localhost,
// so there is only ONE service to deploy / keep warm.
//
// Each child keeps its own code, its own Prisma client, and its own DB — they
// just live in one container now. If any child dies, we tear everything down so
// Render restarts the whole service cleanly.

const { fork } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const gatewayPort = process.env.PORT || "10000";

// Internal ports the gateway proxies to (must match *_SERVICE_URL env vars).
const services = [
  { name: "auth", entry: "apps/auth-service/dist/src/index.js", port: "4003" },
  { name: "judge", entry: "apps/judge-service/dist/index.js", port: "4002" },
  { name: "user", entry: "apps/user-service/dist/index.js", port: "4001" },
  { name: "gateway", entry: "apps/api-gateway/dist/index.js", port: gatewayPort },
];

let shuttingDown = false;

const children = services.map((s) => {
  const child = fork(path.join(root, s.entry), [], {
    env: { ...process.env, PORT: s.port },
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    if (shuttingDown) return;
    console.error(`[start-all] "${s.name}" exited (code ${code}) — stopping all services`);
    shutdown(code || 1);
  });
  return child;
});

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try { c.kill("SIGTERM"); } catch (_) { /* already gone */ }
  }
  process.exit(code);
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

console.log(`[start-all] launched ${services.length} services; gateway on :${gatewayPort}`);
