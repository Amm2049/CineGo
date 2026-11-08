// e2e/roles.spec.ts
// Admin and staff accounts run the cinema; only customer accounts book (Phase 10, step 4 #1).
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("button[type='submit']").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

const FAKE_SHOWTIME = "00000000-0000-0000-0000-000000000000";

test("admin lands on the dashboard and can't use customer pages", async ({ page }) => {
  await login(page, "admin@cinego.com", "admin123");
  await expect(page).toHaveURL("/admin");

  await page.goto("/tickets");
  await expect(page).toHaveURL("/admin");
  await page.goto("/profile");
  await expect(page).toHaveURL("/admin");

  await page.goto(`/checkout/${FAKE_SHOWTIME}`);
  await expect(page.getByRole("heading", { name: "Booking is for customer accounts" })).toBeVisible();

  await page.goto("/movies");
  await expect(page.getByRole("link", { name: "My Tickets" })).toHaveCount(0);
});

test("staff land on the scanner and can't use customer pages", async ({ page }) => {
  await login(page, "staff@cinego.com", "staff123");
  await expect(page).toHaveURL("/admin/scanner");

  await page.goto("/tickets");
  await expect(page).toHaveURL("/admin/scanner");
});

test("booking APIs refuse admin and staff accounts", async ({ page }) => {
  for (const [email, password] of [
    ["admin@cinego.com", "admin123"],
    ["staff@cinego.com", "staff123"],
  ]) {
    await page.context().clearCookies();
    await login(page, email, password);
    // page.request shares the browser's cookies: the APIs themselves refuse non-customers
    const hold = await page.request.post(`/api/showtimes/${FAKE_SHOWTIME}/seats/hold`, {
      data: { seatIds: ["x"] },
    });
    expect(hold.status(), `${email} hold`).toBe(403);
    const pay = await page.request.post("/api/payments", { data: { showtimeId: FAKE_SHOWTIME } });
    expect(pay.status(), `${email} pay`).toBe(403);
    const interests = await page.request.get("/api/user/interests");
    expect(interests.status(), `${email} interests`).toBe(403);
  }
});

test("customers return to the page that asked them to log in", async ({ page }) => {
  const email = `e2e-roles-${Date.now()}@test.cinego.local`;
  const res = await page.request.post("/api/auth/register", { data: { email, password: "password123" } });
  expect(res.ok()).toBeTruthy();
  await page.context().clearCookies(); // registering doesn't log in, but start clean anyway

  await page.goto("/tickets");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Ftickets/);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("password123");
  await page.locator("button[type='submit']").click();
  await expect(page).toHaveURL("/tickets");
  await expect(page.getByRole("link", { name: "My Tickets" })).toBeVisible();
});
