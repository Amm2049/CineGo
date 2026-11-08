# CineGo — Phase 10: Whole-App Manual Testing Checklist

Step 3 of the testing phase. Steps 1–2 (all automated checks, plus the payment-window and late-refund
integration tests) are already done on `phase/phase10-testing`.

**How to use:** work top to bottom, tick `[x]` when a check passes. When something fails, leave it
unticked and write what happened under **Notes** next to it (what you clicked, what you saw, what you
expected). We fix everything in step 4.

---

## 0. Setup

* [ ] `.env` has `PAYMENT_PROVIDER=stripe` (we switch it to the simulated payment in section 8).
* [ ] Terminal 1: `npm run dev` → open http://localhost:3000
* [ ] Terminal 2: `npm run stripe:listen` (never a plain `stripe listen`: the CLI login points at another account).
* [ ] Two browser windows that don't share cookies: a **normal window** (Customer A) and an **incognito window** (Customer B / admin).
* [ ] Keep the browser DevTools **Console** open in the normal window and note any red errors you see along the way.

Test accounts: `admin@cinego.com` / `admin123`, `staff@cinego.com` / `staff123`. Customers: register new ones below.

---

## 1. Guest browsing (logged out)

* [ ] `/` loads: hero spotlight, movie cards with posters, no broken images.
* [ ] `/movies` shows **Now Showing** and **Upcoming** separately. Upcoming movies have a release date in the future; Now Showing ones have showtimes.
* [ ] Format badges on movie cards show a projection format (e.g. "IMAX Laser"), not a theatre name ("Theatre 1").
* [ ] `/experiences` loads and explains IMAX, Dolby, 4DX and VIP.
* [ ] Showtimes are shown in Thai time (compare one with the admin schedule later).
* [ ] Clicking a showtime as a guest asks you to log in (it doesn't crash or show an empty seat map).
* [ ] Opening `/tickets`, `/profile` or `/admin` as a guest redirects to the login page.
* [ ] Phone width (DevTools device toolbar, ~390 px): navbar, movie grid and login page are usable, with no sideways scrolling.

Notes:

---

## 2. Register, log in, log out

* [ ] Register **Customer A** with a new email → you land on `/` already logged in (name/menu in the navbar).
* [ ] Register with the **same email** again → clear error, no crash.
* [ ] Register with mismatched passwords / a password under 8 characters → clear error.
* [ ] Log out → navbar shows Sign In again.
* [ ] Log in with a wrong password → "Invalid email or password".
* [ ] Log in correctly → you land on `/` logged in. *(This is the flow fixed in step 1, so try it a few times, including in a fresh incognito window.)*

Notes:

---

## 3. Interests and AI recommendations (Gemini)

* [ ] `/profile`: pick a few genres, save → success message; reload → the same genres are still selected.
* [ ] `/` and `/movies` now show glowing **🔥 AI Match** badges on some cards, with a sensible reason.
* [ ] Pages stay fast while recommendations refresh (no 20+ second load — fixed in Phase 9).
* [ ] Change your genres → after a reload, the matches change.

Notes:

---

## 4. Seat map and holds (Customer A)

* [ ] Open a showtime's checkout page: screen curve, legend and seat grid render.
* [ ] Prices by row: **A–B VIP ฿280**, **C–D Premium ฿200**, **E–F Standard ฿150**. The total updates as you select and deselect.
* [ ] Selecting seats starts a **5-minute hold timer**.
* [ ] In the incognito window, log in as **Customer B** (register one) and open the same showtime: A's seats show as **held** within ~5 seconds (live polling) and can't be selected.
* [ ] A deselects a seat → within ~5 seconds it becomes available for B.
* [ ] Let A's 5-minute timer run out → A's seats are released and B can take them.
* [ ] Both A and B click the **same free seat** at about the same time → only one of them gets it, the other sees a clear message.

Notes:

---

## 5. PromptPay payment — happy path (Customer A)

* [ ] Select 2 seats → **Pay with PromptPay** → QR code, amount = seat total, and a **10-minute countdown**.
* [ ] Reload the page → the same QR and countdown come back (not a new payment, and the countdown doesn't restart).
* [ ] Open the test-mode link → Stripe's hosted page → **Authorize** → within ~3 seconds you are sent to the ticket.
* [ ] Terminal 2 shows `payment_intent.succeeded` forwarded with a 200 response.
* [ ] Ticket page: movie, showtime (Thai time), theatre, seats, total and a **QR code**.
* [ ] `/tickets` lists it under **Upcoming**.
* [ ] B (incognito) now sees those seats as **booked**.

Notes:

---

## 6. PromptPay — cancel, fail, countdown

* [ ] Start a payment, press **Cancel payment** → seats released with a clear message; B can take them.
* [ ] Start a payment, on Stripe's page choose **Fail** → clear message, seats released, no ticket.
* [ ] Start a payment and let the **10-minute countdown reach 0** → clear message, QR gone; the seats become free for B. *(Automated in step 2; this checks what the customer actually sees.)*
* [ ] While a payment is open, try to change seats → it is refused with "payment in progress".

Notes:

---

## 7. Admin and staff

Log in as **admin** in the incognito window.

* [ ] `/admin` dashboard: numbers look right, with **Recent payments** (including A's payment from section 5) and **Recent scans**.
* [ ] **Movies:** search TMDB and import one title → it appears in the list; importing it again doesn't create a duplicate.
* [ ] **Movies:** edit a title → shown on `/movies`; run the TMDB sync → your edited title is **not** overwritten.
* [ ] **Movies:** deactivate a movie → it disappears from `/` and `/movies`; reactivate → it's back.
* [ ] **Movies:** a customer bought a ticket for a movie, then you deactivate it → the ticket is still in their My Tickets and still scans. Also try booking that movie from a seat map that was already open (known gap, in the step 4 list; note what happens).
* Tip: the seeded showtimes end on 15 Nov 2026. Set the Schedule date to **16 Nov or later** for the add/overlap/delete checks: every theatre is empty there.
* [ ] **Showtimes:** add a showtime → appears in the schedule and on the movie's page for customers.
* [ ] **Showtimes:** add one that overlaps another in the same theatre (including the 25-min cleaning gap) → refused with a clear message.
* [ ] **Showtimes:** delete a showtime without bookings → removed; try deleting one **with** bookings → refused.
* [ ] **Scanner (webcam):** allow the camera, show A's ticket QR (phone photo of the screen, or a second screen):
  * if the show starts **more than 60 min from now** → "Entry opens 60 minutes before…" (TOO_EARLY), ticket not used;
  * to test admission, buy a ticket **as a customer** for a showtime that starts within the next hour (add one in Showtimes if needed) → **ADMITTED**; scan again → **ALREADY_USED**.
* [ ] **Scanner (manual):** type the ticket code by hand → same result as the QR; type `hello` → "This is not a CineGo ticket"; a random UUID → "No ticket exists".
* [ ] After admitting, the ticket shows as used for the customer, and it appears in the dashboard's Recent scans.
* [ ] Log in as **staff**: the scanner works, but `/admin`, Movies and Showtimes are not accessible.
* [ ] As **Customer A**, opening `/admin` is refused.

Notes:

---

## 8. Simulated payment fallback (last deferred Phase 9 check)

* [ ] Stop `npm run dev`, set `PAYMENT_PROVIDER=simulated` in `.env` (or remove the line), start `npm run dev` again.
* [ ] As Customer A, select seats → pay → the booking completes with **no** PromptPay QR and **no** Stripe call, and a ticket is issued.
* [ ] The ticket and `/tickets` look the same as with Stripe.
* [ ] Set `PAYMENT_PROVIDER=stripe` back and restart `npm run dev`.

Notes:

---

## 9. Small items saved from earlier

Check the DevTools Console / terminal and note whether these still appear:

* [ ] Warning about the first poster image being the LCP image (`loading="eager"` / priority).
* [ ] Warning about `data-scroll-behavior="smooth"` on `<html>`.
* [ ] next/image warning: a TMDB poster "has either width or height modified, but not the other".
* [ ] Any other red errors seen during sections 1–8 (list them in Notes).

Notes:

---

## Step 4 — fixes to make

Collected while testing; done after the manual checks.

* [x] **Admin/staff accounts can't book tickets** *(done 2026-11-08, `feature/staff-cannot-book`)* *(found 2026-11-08: the admin could book and buy; the scope never decided this; decision: admin and staff accounts only run the cinema)*
  * `src/proxy.ts`: ADMIN/STAFF opening `/checkout`, `/tickets` or `/profile` → sent to `/admin` (staff → `/admin/scanner`).
  * APIs refuse non-customers server-side: seat hold/release, `/api/payments*`, `/api/user/interests`.
  * UI: hide "Book"/seat-selection links and the customer menu items for admin/staff; after login, send admin/staff straight to `/admin` (staff → scanner).
  * Browsing `/`, `/movies`, `/experiences` stays open to every role.
  * Add e2e tests: admin and staff are redirected from checkout and get 403 from the booking APIs.
* [x] **Hidden (deactivated) movies can't be sold** *(done 2026-11-08, `feature/hidden-movies-not-sold`)* *(found 2026-11-08: deactivate only removes the movie from the listings; checkout, seat holds and payments don't check `Movie.isActive`, so an open seat map, an open QR or a saved `/checkout/<id>` link still sells tickets)*
  * Tickets already bought stay valid: My Tickets and the scanner keep working (don't change this).
  * Seat map for a hidden movie's showtime shows "This movie is no longer on sale" instead of the seat grid.
  * Server refuses new seat holds (`holdShowtimeSeats()`) and new payments (`startStripePayment()`, `confirmBookingPayment()`) when the movie is inactive.
  * A PromptPay payment that was already open may still finish (the customer may have scanned already; blocking it would only cause a refund).
  * Tests: a hold and a payment start for an inactive movie are refused; an open payment still settles.
* [x] **Confirm before deactivating a movie with sold tickets** *(done 2026-11-08)*
  * Admin Movies → Deactivate shows a confirmation with the number of tickets sold for upcoming showtimes, and says those tickets stay valid.
  * No sold tickets → deactivate right away, as now.
  * *Out of scope:* actually cancelling a show and refunding its tickets (no such feature exists; mention as future work in the report).
* [x] **P1 — Customers can choose a showtime** *(done 2026-11-08, `feature/showtime-picker`)* *(found 2026-11-08: a movie card links straight to ONE arbitrary showtime — `getNowShowingMovies()` takes `showtimes[0]` with no `orderBy` — so customers can't pick the date, time or theatre; not in the scope's page list (`CiniGo_Scope.md` §4.1), so it was never built)*
  * Movie → showtime picker: a date strip (Today, Tomorrow, … up to the last scheduled day) → times grouped by theatre/format, each linking to `/checkout/<showtimeId>`.
  * Past showtimes hidden; sold-out ones shown but disabled; Bangkok time.
  * Showtimes always ordered by `startsAt` wherever a "next showtime" is used.
  * Seat map page: a "Change showtime" link back to the picker.
  * Add it to the scope's page list; e2e test: pick tomorrow → a time → the right seat map opens.
* [x] **Scanner: recover from a camera error without reloading** *(done 2026-11-08, `feature/scanner-ui`)* — a "Try again" button that restarts the camera, plus short steps for allowing the camera (browser address-bar icon → Camera → Allow; Windows Settings → Privacy & security → Camera).
* [x] **Showtimes page UI/UX** *(P1+P2 done 2026-11-08, `feature/showtimes-ui`; also fixed the 414 px phone overflow)* *(review 2026-11-08; P3 ideas — timeline view, searchable movie select, styled delete dialog — kept as future work)*
  * P1: a clash disables "Create showtime" and shows a red error (not an amber hint), ideally with "Use next free time". The form's default start must not already clash.
  * P1: the form date and the schedule date stay in sync (picking another date in the form loads that day's schedule; the clash pre-check uses the right day).
  * P1: past shows dimmed, the current one tagged "Now playing".
  * P2: "sold" shows capacity (`12 / 60 sold`), maybe a small bar.
  * P2: quieter delete control, ≥ 44 px tap targets on mobile, disabled reason shown as visible text ("Has bookings"), not only a hover tooltip.
  * P2: day navigation with ‹ Today › buttons and the weekday ("Sun 8 Nov").
  * P2: consistent wording ("Theatre" in the form too) and a clear 24-hour time hint.
* [x] **Ticket scanner UI/UX** *(P1+P2 done 2026-11-08, `feature/scanner-ui`)* *(review 2026-11-08; P3 ideas — auto-continue after Admit, camera switch, staff fullscreen mode — kept as future work)*
  * P1: the result covers the camera area while paused, so it is visible without scrolling on a phone.
  * P1: for Admit, the number of people is prominent: "ADMIT 3 · F4, F5, F6" (one ticket covers the whole booking).
  * P2: larger camera on desktop and a ready message ("Ready — hold the ticket QR inside the frame") instead of an empty right column.
  * P2: Recent scans use the human labels and colours, not raw codes like `INVALID_CODE`.
  * P2: the result message says what to do next instead of repeating the title.
  * P2: short manual-entry placeholder ("Ticket code") plus help text (the current placeholder is cut off).
  * P2: a short sound and/or vibration for admit and a different one for reject.
* [x] **Recheck admin landing page priority and nav order** *(done 2026-11-08, `feature/staff-cannot-book`)*
  * Where admin/staff land after logging in (today: the customer home page `/`; staff → scanner?). Connects to the "admin/staff can't book" item.
  * Admin nav order (today: Dashboard · Movies · Showtimes · Ticket Scanner): order it by how often each page is used and what matters most on the dashboard; decide whether the site's customer nav (Movies, Experiences, My Tickets) should show for admin/staff at all.
* [ ] Warnings from section 9 (LCP poster image, `data-scroll-behavior`, next/image width/height) and the pg "client.query() while already executing" warning in the concurrency script.

---

## Result

* [x] Every section passes, or each failure is written down in its Notes → hand the list to Claude for **step 4 (fixes)**, then merge `phase/phase10-testing` → `develop` → `main`. *(2026-11-08: sections 0–9 tested by the user, all passing, including the simulated payment fallback; the issues found along the way are in "Step 4 — fixes to make")*
