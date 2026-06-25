import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@grindset/auth-shared": path.resolve(__dirname, "../../packages/auth-shared/src/index.ts"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:4000",
      "/auth": "http://localhost:4000",
      "/mfa": "http://localhost:4000",
      "/oauth": "http://localhost:4000",
      "/.well-known": "http://localhost:4000",
    },
  },
});
