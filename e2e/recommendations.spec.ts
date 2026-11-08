// e2e/recommendations.spec.ts
// A brand-new customer (no favourite genres, no bookings) sees no AI match badges (Phase 10).
import { test, expect } from "@playwright/test";

test("a new customer sees no match badges until they pick genres or book", async ({ page }) => {
  const email = `e2e-recs-${Date.now()}@test.cinego.local`;
  expect((await page.request.post("/api/auth/register", { data: { email, password: "password123" } })).ok()).toBeTruthy();
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("password123");
  await page.locator("button[type='submit']").click();
  await page.waitForURL("/");

  await expect(page.getByText("View All Movies")).toBeVisible();
  await expect(page.getByText(/🔥 \d+%/)).toHaveCount(0);
  await page.goto("/movies");
  await expect(page.locator('a[href^="/movies/"]').first()).toBeVisible();
  await expect(page.getByText(/🔥 \d+%/)).toHaveCount(0);
});
