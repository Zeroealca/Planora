import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

/**
 * Browser tests deliberately run Vite with an invalid Supabase URL. This keeps
 * the safe smoke suite entirely local even when a developer has a real .env.
 */
export default defineConfig({
  testDir: "./e2e",
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
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: "https://e2e.invalid",
      VITE_SUPABASE_ANON_KEY: "e2e-placeholder",
    },
  },
});
