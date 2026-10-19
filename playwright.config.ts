import { defineConfig, devices } from "@playwright/test";
import { readE2EConfig } from "./e2e/helpers/env";

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

/**
 * Safe by default: Vite boots with an invalid Supabase URL so smoke tests never
 * touch a real project (including production), even if a local .env exists.
 *
 * Authenticated specs opt in with E2E_* variables and must pass the local or
 * remote isolation guard in e2e/helpers/env.ts before Vite can use them.
 */
const e2e = readE2EConfig();

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "safe-smoke",
      testMatch: "safe-smoke.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "local-chromium",
      testIgnore: "safe-smoke.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    // An authenticated run must boot with its own explicitly guarded env.
    // Reusing a prior safe-smoke Vite process would silently keep e2e.invalid.
    reuseExistingServer: !process.env.CI && !e2e,
    env: e2e
      ? {
          VITE_SUPABASE_URL: e2e.supabaseUrl,
          VITE_SUPABASE_ANON_KEY: e2e.supabaseAnonKey,
        }
      : {
          VITE_SUPABASE_URL: "https://e2e.invalid",
          VITE_SUPABASE_ANON_KEY: "e2e-placeholder",
        },
  },
});
