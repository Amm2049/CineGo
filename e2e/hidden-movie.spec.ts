// e2e/hidden-movie.spec.ts
// Deactivating a movie that has sold tickets asks first; a hidden movie is off sale (Phase 10, step 4 #3).
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("button[type='submit']").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("deactivating a movie with sold tickets asks first, then stops sales", async ({ browser }) => {
  // ── A customer buys a ticket (needs the simulated provider, as in CI) ──
  const customerCtx = await browser.newContext();
  const customer = await customerCtx.newPage();
  const email = `e2e-hidden-${Date.now()}@test.cinego.local`;
  expect((await customer.request.post("/api/auth/register", { data: { email, password: "password123" } })).ok()).toBeTruthy();
  await login(customer, email, "password123");

  await customer.goto("/movies");
  const movieHref = (await customer.locator('a[href^="/movies/"]').first().getAttribute("href"))!;
  const movieId = movieHref.split("/").pop()!;
  await customer.goto(movieHref);
  const showtimeId = (await customer.locator('a[href^="/checkout/"]').last().getAttribute("href"))!.split("/").pop()!;

  const seatMap = await (await customer.request.get(`/api/showtimes/${showtimeId}/seats`)).json();
  const seat = seatMap.seats.filter((s: { status: string }) => s.status === "AVAILABLE").pop();
  expect((await customer.request.post(`/api/showtimes/${showtimeId}/seats/hold`, { data: { seatIds: [seat.id] } })).ok()).toBeTruthy();
  const paid = await (await customer.request.post("/api/payments", { data: { showtimeId } })).json();
  if (paid.provider !== "simulated") {
    if (paid.checkout?.paymentId) await customer.request.post(`/api/payments/${paid.checkout.paymentId}/cancel`);
    test.skip(true, "Needs PAYMENT_PROVIDER=simulated to buy a ticket without Stripe (CI uses it).");
  }
  expect(paid.success).toBe(true);

  // ── The admin sees the sold tickets and is asked before hiding ──
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, "admin@cinego.com", "admin123");
  try {
    await admin.goto("/admin/movies");
    const title = (await customer.request.get(`/api/showtimes/${showtimeId}/seats`).then((r) => r.json())).showtime.movie.title;
    const row = admin.getByRole("row").filter({ has: admin.getByText(title, { exact: true }) });
    await expect(row.getByText(/\d+ tickets? sold/)).toBeVisible();

    // Cancel the confirmation → nothing changes
    let message = "";
    admin.once("dialog", (d) => {
      message = d.message();
      void d.dismiss();
    });
    await row.getByRole("button", { name: "Deactivate" }).click();
    expect(message).toContain("sold for upcoming shows");
    expect(message).toContain("stay valid");
    await expect(row.getByText("Active", { exact: true })).toBeVisible();

    // Confirm → hidden
    admin.once("dialog", (d) => void d.accept());
    await row.getByRole("button", { name: "Deactivate" }).click();
    await expect(row.getByText("Hidden", { exact: true })).toBeVisible();

    // ── Off sale for customers; the bought ticket is still there ──
    await customer.goto(`/checkout/${showtimeId}`);
    await expect(customer.getByRole("heading", { name: "This movie is no longer on sale" })).toBeVisible();
    const another = seatMap.seats.filter((s: { status: string }) => s.status === "AVAILABLE")[0];
    const hold = await customer.request.post(`/api/showtimes/${showtimeId}/seats/hold`, { data: { seatIds: [another.id] } });
    expect(hold.ok()).toBeFalsy();
    expect((await hold.json()).error).toBe("This movie is no longer on sale.");
    await customer.goto(movieHref);
    await expect(customer.getByRole("heading", { name: "404" })).toBeVisible();
    await customer.goto("/tickets");
    await expect(customer.getByText(title).first()).toBeVisible();
  } finally {
    // Put the movie back on sale for the other tests
    await admin.request.patch(`/api/admin/movies/${movieId}`, { data: { isActive: true } });
    await adminCtx.close();
    await customerCtx.close();
  }
});
