import { expect, test } from "@playwright/test";

test("redirects an anonymous visitor from a private route without contacting Supabase", async ({
  page,
}) => {
  const supabaseRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname.endsWith(".supabase.co"))
      supabaseRequests.push(request.url());
  });

  await page.goto("/budget");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Planora" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Configura VITE_SUPABASE_URL",
  );
  expect(supabaseRequests).toEqual([]);
});

test("keeps a private route protected after a browser reload on mobile", async ({
  page,
}) => {
  await page.goto("/projects");
  await page.reload();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("status")).toContainText(
    "VITE_SUPABASE_ANON_KEY",
  );
});

test("does not expose authenticated navigation while Supabase is unconfigured", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Presupuesto" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(
    0,
  );
});
