**English** · [Українська](qa-report.uk.md)

# QA report — Virtual Data Room

**Version:** commit `9c85149`, live site · **Tested:** 2026-10-20 · **Time:** 24 hours

## Verdict: ❌ Not ready for a real customer yet, but close

**Most things work well:**
- the second user really cannot change anything;
- a public link cannot be used to reach other folders;
- revoke works immediately;
- folders and files behave as the requirements say.

**One bug blocks the release:**

| Blocker | Why |
|---|---|
| **F-21:** anyone can take a share meant for someone else | The owner shares a folder with an email that has no account yet, which is normal when you invite a buyer's lawyer. Whoever signs up with that email first gets the documents, because the app never checks that the person owns the email. I confirmed this on the live site. |

**Can be released when:**
1. F-21 is fixed: confirm the email at sign-up, or send an invitation link to that email.
2. Ideally also F-02 and F-10 (medium):
   - the server should check that an uploaded file is a real PDF of the stated size;
   - one item should have only one public link, so Revoke closes everything.

These are days of work, not weeks. Each fix already has an automated test that will confirm it.

## What was tested

| Area | How deep | Result |
|---|---|---|
| Access: the second user is read-only and cannot open other items | Deep: API and UI, 12 ways to change data + 7 attempts to open other items | ✅ no leaks |
| Public links: what is visible, revoke, new link, deleted folder | Deep: API and UI with a browser that is not logged in | ✅ except F-10 |
| Sharing with a person | Deep, including an email that has no account | ❌ **F-21**, plus small: F-05, F-16 |
| Upload: several files, same names, type, size, content | Deep | ❌ F-02, F-01, small: F-12 |
| Folders: create, nest, rename, delete, breadcrumbs, pages | Deep | ✅ except F-11 (API only) |
| Files: view, download, rename, move, delete | Medium | ✅ |
| Special characters, errors, unknown fields | Medium | ⚠️ F-03, F-13, F-14 |
| Login and session | Medium | ⚠️ F-15, R-03, R-04 |
| Look and feel | Light | ⚠️ small: F-18, F-19, F-20 |

**How:**
- First I read the code and the API docs.
- Then I tested by hand in six sessions, with the owner and the second user logged in at the same time.
- For every bug I checked whether a normal user can hit it in the UI, or only through the API. This lowered the priority of 9 bugs.

Details: [test-plan.md](test-plan.md), [test-cases.md](test-cases.md) (69 checks), [findings.md](findings.md).

**Not tested:**
- load (shared production);
- brute force (no limits, found in code, not attacked);
- other browsers;
- accessibility.

## Main problems and risks
**21 bugs:** 1 high, 4 medium and 16 low priority. There are also 3 design risks.

They come from a few common causes:
1. **No identity check** (F-21). Sign-up does not confirm the email, and sharing trusts the email.
2. **The server trusts the client** (F-02, F-04, F-13):
   - it accepts the file type and size the client states;
   - it accepts any extension through the API;
   - it ignores unknown fields.
3. **Duplicates when two requests come at once** (F-01, F-10, F-11). The database has no rule that names or links must be unique, so the check fails under load. One fix (unique rules in the database) closes all three.
4. **Names are not cleaned** (F-03): invisible and direction-flipping characters are allowed.
5. **Session** (F-15, R-03, R-04):
   - the token lives 7 days and cannot be cancelled;
   - other tabs still show data after sign-out;
   - there is no limit on login attempts.

## Automated tests

**65 automated tests, about 3 minutes for the full run:**
- 50 check what works, and they pass;
- 15 reproduce known bugs: they fail on purpose, and each fails for the right reason.

| Level | Tests | What it covers |
|---|---|---|
| Contract | 3 + every API answer | The live API documentation matches the saved copy, and every API answer in every test matches the documentation |
| API | 56 | Smoke check, login, folders, files, access rules, public links, 14 known bugs |
| Browser | 6 | Upload and view, public link → visitor → revoke, the second user sees read-only, login, F-10 |

**Not automated:**
- **F-21:** the test would need to create new accounts on the shared production on every run;
- **drag and drop:** the same upload is tested through the file picker;
- **sharing a whole room:** on the shared demo account it would give the second user access to other people's data;
- **F-15 and F-16.**

**About the framework:**
- it is safe for a shared site: own folder per run, deleted at the end;
- passwords come only from `.env` or CI secrets;
- a custom report shows the status of every known bug;
- GitHub Actions runs it on every push and every night.

## What to test or automate next
1. **After the fixes:** the known-bug tests are the acceptance tests. Remove "expected to fail" when they pass. Add an automated test for F-21 in a separate test environment.
2. **For developers:** today the product has 42 unit tests that do not use a real database, no frontend tests and no CI. Next, add:
   - tests with a real database (unique names, delete, sharing);
   - input validation tests;
   - a simple CI.
3. **Security, in a separate environment:**
   - login attempt limits;
   - storage settings (size and type limits);
   - security headers.
4. **Large data:** the product says one room can hold 100 000 files. Test the list speed, delete speed and very deep folders.
5. **More browser tests:**
   - real drag and drop;
   - upload retry after an error;
   - the move dialog;
   - phone screen;
   - Firefox and Safari.
6. **More by hand:**
   - after sign-out, the next user must not see the previous user's data (the product README says this was fixed);
   - opening a link while logged out;
   - what happens when the 7-day token expires.
