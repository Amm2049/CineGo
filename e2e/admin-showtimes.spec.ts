// e2e/admin-showtimes.spec.ts
// Add showtime form + schedule (Phase 10, step 4 #4). Uses a day 30 days ahead, past the seeded schedule.
import { test, expect } from "@playwright/test";

const bangkokDay = (offsetDays: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(Date.now() + offsetDays * 86_400_000));

test("the form suggests a free time, blocks a clash and offers the next free time", async ({ page }) => {
  const day = bangkokDay(30);
  await page.goto("/login");
  await page.locator("#email").fill("admin@cinego.com");
  await page.locator("#password").fill("admin123");
  await page.locator("button[type='submit']").click();
  await page.waitForURL("/admin");

  await page.goto(`/admin/showtimes?date=${day}`);
  const form = page.locator("form");
  const create = form.getByRole("button", { name: "Create showtime" });
  const created: string[] = [];
  page.on("response", async (res) => {
    if (res.url().endsWith("/api/admin/showtimes") && res.request().method() === "POST" && res.ok()) {
      const { showtimeId } = await res.json();
      if (showtimeId) created.push(showtimeId); // cleaned up in finally if the test fails midway
    }
  });

  try {
    // The form date is the schedule date
    await expect(form.locator('input[type="date"]')).toHaveValue(day);
    // Pick Theatre 4 so the test doesn't depend on which movie is first
    await form.getByLabel("Theatre").selectOption({ label: "Theatre 4 · Standard" });
    // The schedule follows the form's theatre: only Theatre 4 is listed, its chip is pressed
    const chips = page.getByRole("group", { name: "Show theatre" });
    await expect(chips.getByRole("button", { name: /^Theatre 4/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 3, name: /Theatre 4/ })).toBeVisible();

    // An empty day: the suggestion is opening time, with no error
    await expect(form.getByLabel("Hour")).toHaveValue("10");
    await expect(form.getByLabel("Minute")).toHaveValue("00");
    await expect(form.getByRole("alert")).toHaveCount(0);
    await create.click();
    const theatre4 = page.locator("div.rounded-2xl").filter({ has: page.getByRole("heading", { name: /Theatre 4/ }) });
    await expect(theatre4.getByText(/^10:00–/)).toBeVisible();
    await expect(theatre4.getByText(/^0 \/ \d+ sold$/)).toBeVisible();

    // The next suggestion already skips the new show
    await expect(form.getByLabel("Hour")).not.toHaveValue("10");

    // Asking for 10:00 again → red error, Create disabled, "Use next free time" fixes it
    await form.getByLabel("Hour").selectOption("10");
    await form.getByLabel("Minute").selectOption("00");
    await expect(form.getByRole("alert")).toContainText("Clashes with");
    await expect(create).toBeDisabled();
    await form.getByRole("button", { name: /Use next free time/ }).click();
    await expect(form.getByRole("alert")).toHaveCount(0);
    await expect(create).toBeEnabled();

    // Day navigation: › and ‹ move the schedule and the form together
    await page.getByRole("link", { name: "Next day" }).click();
    await expect(page).toHaveURL(`/admin/showtimes?date=${bangkokDay(31)}`);
    await expect(form.locator('input[type="date"]')).toHaveValue(bangkokDay(31));
    await page.getByRole("link", { name: "Previous day" }).click();
    await expect(page).toHaveURL(`/admin/showtimes?date=${day}`);

    // "All" lists every theatre again
    await chips.getByRole("button", { name: /^All/ }).click();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(4);
    await chips.getByRole("button", { name: /^Theatre 4/ }).click();

    // Delete the test show (quiet button, confirm dialog)
    page.once("dialog", (d) => void d.accept());
    await theatre4.getByRole("button", { name: /^Delete .* at 10:00$/ }).click();
    await expect(theatre4.getByText("Nothing scheduled.")).toBeVisible();
    created.length = 0;
  } finally {
    for (const id of created) await page.request.delete(`/api/admin/showtimes/${id}`);
  }
});
