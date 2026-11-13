# Local verification record

Date: 2026-11-13

## Checks run

- Ran `node --check` across the backend controllers, routes, middleware, migration runner, and database preparation script.
- Built the production frontend with `frontend/node_modules/.bin/vite.cmd build` successfully.
- Ran `node scripts/prepareDatabase.js` after the migrations; it completed and reported that existing allocations were preserved.
- Verified the local admin and student demo logins through HTTP.
- Verified the API returns two branches, 12 Main Hostel rooms, four Garden Annex rooms, eight seeded roles, and a two-row page from the five demo residents.
- Verified a student request for another branch returns HTTP 403 and a student request for team administration returns HTTP 403.
- Exercised admission approval, first-login password update, Annex bed assignment, private PDF upload/download, visitor check-in/check-out, and maintenance creation using synthetic records.
- Verified a synthetic admission document, confirmed the status appears as `verified`, and confirmed another hostel cannot change it.
- Verified a new account's initial password gate returns HTTP 428 until the password is changed, and branch access returns HTTP 403 after password reset when the user names another branch.
- Generated monthly invoices for both branches and repeated the same billing period; the second run created zero duplicates. Verified generated balances matched the current recurring rate card, without recording payments.
- Applied migrations through `013_document_verification.sql`; reran demo preparation successfully and confirmed it preserves existing allocations and checkout history.
- Created a synthetic Annex admission with a guardian email, approved it, created the linked parent account, verified the first-login password gate (`428`), changed the password, and confirmed one linked resident and leave history are returned. The parent token is denied access to Main Hostel (`403`).
- Recorded staff attendance and read the saved `present` status back for that date.
- Started a meal subscription, recorded a lunch check-in, and confirmed duplicate check-in is rejected (`409`). A subscription attempt for a resident from another branch is rejected (`404`).
- Added a synthetic complaint update with a note and priority; the complaint API returns the saved status history.
- Recorded a synthetic hostel expense and confirmed it appears in the current-month report. The pending-fee report matched the open invoice totals plus legacy pending requests.
- Tried to record a payment one rupee above an invoice balance; the API returned `400` and the invoice remained unpaid.
- Transferred a synthetic Annex resident to a free room, confirmed the prior allocation was retained, checked the resident out, and confirmed the second allocation was marked released and room occupancy decreased.
- Reused the newly released Annex bed for another active resident, confirming the bed-level unique active-allocation constraint permits reuse without losing the prior resident's history.
- Opened the frontend and confirmed the expired legacy browser session returned to the redesigned login page with demo credentials visible.
- Verified `GET /health` reports `{ status: "ok", database: "ready" }`; confirmed the frontend responds with HTTP 200.

## Run the local demo

From the project root, set the PostgreSQL values in `.env`, load `hostel_schema.sql` into a new database once, then run `npm.cmd run prepare-db`. Start the API with `npm.cmd start` and Vite from `frontend` with `npm.cmd run dev`.

Demo logins: `admin@hostel.com / admin123` and student ID `1 / student123` (unless overridden in `.env`). Keep the demo passwords local and replace them before using real resident data.

## Known limits

The checks above cover build, repeatable database setup, login, pagination, admissions, private document access, visitor logging, maintenance, first-login password changes, invoice generation and overpayment rejection, parent access, staff attendance, meal check-ins, expenses, and branch boundaries. Refund-limit edge cases, all concurrency boundaries, and every master-brief item still need broader testing or implementation as noted in the plan.
