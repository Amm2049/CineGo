import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("button[type='submit']").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("admin can open every admin page", async ({ page }) => {
  await login(page, "admin@cinego.com", "admin123");
  for (const [path, heading] of [
    ["/admin", "Dashboard"],
    ["/admin/movies", "Movies"],
    ["/admin/showtimes", "Add showtime"],
    ["/admin/scanner", "Ticket Scanner"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
});

test("customers cannot reach the admin panel or admin APIs", async ({ page }) => {
  const email = `e2e-${Date.now()}@test.cinego.local`;
  const res = await page.request.post("/api/auth/register", { data: { email, password: "password123" } });
  expect(res.ok()).toBeTruthy();

  await login(page, email, "password123");
  await page.goto("/admin");
  await expect(page).toHaveURL("/");

  // page.request shares the browser's cookies: this proves the API itself refuses customers
  const api = await page.request.post("/api/admin/verify-ticket", { data: { code: "x" } });
  expect(api.status()).toBe(403);
});

test("staff can use the scanner but nothing else", async ({ page }) => {
  await login(page, "staff@cinego.com", "staff123");

  await page.goto("/admin/scanner");
  await expect(page.getByRole("heading", { name: "Ticket Scanner", exact: true })).toBeVisible();

  await page.goto("/admin/movies");
  await expect(page).toHaveURL("/admin/scanner"); // proxy sends staff back

  const api = await page.request.post("/api/admin/movies/sync-all");
  expect(api.status()).toBe(403); // and the API refuses too
});

test("the scanner rejects a code that is not a CineGo ticket", async ({ page }) => {
  await login(page, "admin@cinego.com", "admin123");
  await page.goto("/admin/scanner");
  await page.getByPlaceholder(/paste the ticket code/i).fill("hello");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("This is not a CineGo ticket.", { exact: true })).toBeVisible();
});

test("guests get 401 from admin APIs and the cron route", async ({ request }) => {
  expect((await request.post("/api/admin/movies/sync-all")).status()).toBe(401);
  expect((await request.get("/api/cron/sync-movies")).status()).toBe(401);
  const wrong = await request.get("/api/cron/sync-movies", { headers: { Authorization: "Bearer wrong" } });
  expect(wrong.status()).toBe(401);
});
