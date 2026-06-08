import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    env: {
      APP_NAME: "Surls",
      BASE_URL: "http://localhost:3000",
      AUTH_SECRET: "test-secret-that-is-long-enough-for-surls",
      WEBAUTHN_ORIGIN: "http://localhost:3000",
      WEBAUTHN_RP_ID: "localhost"
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"]
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
