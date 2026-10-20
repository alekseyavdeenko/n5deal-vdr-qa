# QA Report — Virtual Data Room

**Build:** commit `9c85149` (2026-10-16), production deployment · **Tested:** 2026-10-20 · **Time box:** 24 h

## Verdict: ❌ Not ready for a real due-diligence customer, but close

The foundations are solid:
- read-only sharing is enforced on the server;
- link scope cannot be escaped;
- revocation works;
- core folder and file flows behave as specified.

**Two defects break promises that a data room cannot afford to break.**

| Blocker | Why it blocks |
|---|---|
| **F-10** Revocation can be silently incomplete | A double-click creates two public links, and revoking in the UI kills only one. The owner thinks access is gone, but it isn't. |
| **F-02** Uploads are not verified server-side | Any file can enter the room as a "PDF", and the 50 MB limit can be bypassed. |

**Release when:**
- F-10 and F-02 are fixed and their tests in `known-bugs` start passing;
- F-01 and F-11 are fixed (both come from the same root cause: missing DB uniqueness constraints);
- the product decides on R-01 (email verification, or not allowing shares to unregistered emails).

Each item takes days, not weeks, and every fix already has an automated test that will confirm it.

## What was tested

| Area | Depth | Result |
|---|---|---|
| Access control: viewer read-only, IDOR, breadcrumbs boundary | Deep: API matrix of 12 mutations + 7 escape attempts, plus UI | ✅ No leak found |
| Public links: scope, revoke, re-share, deleted target | Deep: API + UI with anonymous browser | ✅ except **F-10** |
| Upload: multi-file, conflicts, type and size limits, content, abandoned uploads | Deep | ❌ **F-02**, **F-01**, F-12 |
| Folders: create, nest, rename, delete warning, cascade, breadcrumbs, pagination | Deep | ✅ except **F-11** (concurrency) |
| Files: view, download, rename, move, delete | Medium | ✅ |
| Input handling: Unicode, control characters, XSS, limits, unknown fields | Medium | ⚠️ F-03, F-13, F-14 |
| Auth and session | Medium | ⚠️ F-15, R-03, R-04 |
| UX: empty and error states, dialogs, toasts, narrow viewport | Light | ⚠️ minor: F-16, F-18, F-19, F-20 |

**Method.**
- Risk-based and gray-box: source and OpenAPI recon first, then 6 exploratory charters.
- Owner and recipient were logged in at the same time in two browsers.
- Every finding was reproduced on the live system.
- See [test-plan.md](test-plan.md) and [findings.md](findings.md).

**Not tested, and why:**
- **Load / performance:** shared production environment.
- **Brute force / rate limits:** confirmed absent by code, not hammered live.
- **Cross-browser:** Chromium only.
- **Accessibility audit.**
- **Email-squatting end to end (R-01):** would need registering accounts on someone else's production. The behaviour is documented by the API itself.

## Key issues and risks

**20 findings and 4 design risks.**
- By priority: 4 high, 5 medium, 11 low.
- By theme:
  1. **Concurrency without DB constraints** (F-01, F-10, F-11, F-14). One root cause behind three of the four high-priority bugs: uniqueness is checked in code (`findFirst`, then `create`), not enforced by the database. **Recommendation:** unique and partial-unique indexes, plus disabled buttons while a request is pending.
  2. **The server trusts the client** (F-02, F-04, F-13). Declared MIME type and size, extension, and unknown fields are accepted as sent.
  3. **Names are not normalized** (F-03). Spoofing and invisible duplicates.
  4. **Session model** (F-15, R-03, R-04). A token lives 7 days in localStorage and cannot be revoked, other tabs keep showing loaded data after logout until the next action, and there is no throttling.
  5. **Sharing to unverified identities** (R-01). Email squatting.

## Automated coverage

**65 automated tests:**
- **50 regression checks:** they pass, so these behaviours are protected.
- **15 known-bug reproductions:** they fail on purpose, each for the right reason.

The full suite runs in about 3 minutes.

| Layer | Tests | What it protects |
|---|---|---|
| Contract | 3 + every response | Live OpenAPI == snapshot. Every API response in every test is validated against the spec (status + body) |
| API | 56 | Smoke, auth, folders, files, the access-control matrix, public links, and 14 known bugs |
| E2E (browser) | 6 | Owner upload → view; public link → anonymous visitor → revoke; viewer read-only UI; login; F-10 via a real double-click |

**Coverage map of the task.md requirements:**
- every functional requirement has at least one automated check, with three exceptions:
  - drag-and-drop: the same upload pipeline is covered through the file input;
  - per-file progress: asserted only through the final "Done" state;
  - sharing a whole data room: deliberately not automated here, because on the shared demo account a room share would expose other people's data to the viewer account. Folder and file sharing use the same access-resolution code;
- every high- and medium-priority finding except F-16 has an automated reproduction.

**Framework properties:**
- runs safely against a shared environment (isolated run folders, auto-cleanup, sweep of crashed runs);
- credentials only from `.env` or CI secrets;
- known-bug tracking turns red automatically when a fix ships;
- GitHub Actions pipeline: smoke → API → E2E, plus a nightly run.

## What to test or automate next

1. **After the fixes:** the `@known-bug` tests are the acceptance tests. Remove `test.fail()` as each starts passing.
2. **Product unit and integration tests (dev team).** Today: 42 unit tests with Prisma mocked, no web tests, no CI. Add, in this order:
   - service-level tests against a real Postgres (Testcontainers): uniqueness under concurrency, cascade delete, `resolveName`;
   - DTO validation tests;
   - a minimal CI.
3. **Security pass in a dedicated environment:**
   - rate limiting and lockout once added;
   - the R-01 squatting scenario end to end;
   - storage bucket policy (size and MIME limits, CORS);
   - security headers.
4. **Scale (the README claims 100k files per room):**
   - a seeded room with 100k files: listing latency, delete-preview and cascade-delete time;
   - deep nesting (the `path` index limit is around 70 levels in theory).
5. **More E2E:**
   - drag-and-drop with a real DataTransfer;
   - upload retry after a failed step (likely broken by `x-upsert:false`, per source);
   - move dialog;
   - narrow and mobile viewport;
   - a second browser engine.
6. **Exploratory follow-ups:**
   - the "logout → next user sees cached data" regression the product README says was fixed;
   - deep-link return after login;
   - behaviour after token expiry.
