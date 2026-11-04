import { test, expect } from "@playwright/test";

test("homepage renders the catalog", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("View All Movies")).toBeVisible();
});

test("movies page lists now showing titles", async ({ page }) => {
  await page.goto("/movies");
  await expect(page.locator("a[href^='/checkout/']").first()).toBeVisible();
});

test("guests are redirected from /admin to login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin/);
});
