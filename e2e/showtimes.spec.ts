// e2e/showtimes.spec.ts
// Customers choose the date, time and theatre (Phase 10, step 4 #2).
import { test, expect } from "@playwright/test";

test("a customer picks a day and a time, then lands on that showtime's seat map", async ({ page }) => {
  const email = `e2e-picker-${Date.now()}@test.cinego.local`;
  const res = await page.request.post("/api/auth/register", { data: { email, password: "password123" } });
  expect(res.ok()).toBeTruthy();
  await page.context().clearCookies();

  // Catalog → movie page
  await page.goto("/movies");
  const card = page.locator('a[href^="/movies/"]').first();
  const movieHref = await card.getAttribute("href");
  await card.click();
  await expect(page).toHaveURL(movieHref!);
  await expect(page.getByRole("heading", { name: "Showtimes" })).toBeVisible(); // movie page rendered
  const title = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();

  // Pick the second day in the strip (the seed schedules every day for two weeks)
  const days = page.getByRole("navigation", { name: "Choose a date" }).getByRole("link");
  expect(await days.count()).toBeGreaterThan(1);
  await days.nth(1).click();
  await expect(days.nth(1)).toHaveAttribute("aria-current", "date");
  const day = new URL(page.url()).searchParams.get("date");
  expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  // Pick a time → guests are asked to log in, then return to that seat map
  const time = page.locator('a[href^="/checkout/"]').first();
  const checkoutHref = (await time.getAttribute("href"))!;
  await time.click();
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("password123");
  await page.locator("button[type='submit']").click();
  await expect(page).toHaveURL(checkoutHref);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  // "Change showtime" goes back to the same movie and day
  await page.getByRole("link", { name: "Change showtime" }).click();
  await expect(page).toHaveURL(`${movieHref}?date=${day}`);
});

test("a hidden or unknown movie page shows Not Found", async ({ page }) => {
  // The (customer) loading.tsx streams the page, so the HTTP status is already 200 when notFound()
  // runs; Next then renders the not-found page (with noindex). Check what the visitor sees.
  await page.goto("/movies/00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Showtimes" })).toHaveCount(0);
});
