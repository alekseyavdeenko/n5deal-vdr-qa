# Test Cases and Execution Log — Virtual Data Room

These are the checks executed on 2026-10-20 against production (commit `9c85149`), grouped by the requirements in `task.md`.

**How each check was run:**
- **M** = manual, in the UI. Owner and viewer were logged in at the same time in two browsers.
- **X** = exploratory API probe, from the logged-in browser session.
- **A** = automated. The column names the spec file under `tests/`.

**Result:**
- ✅ Pass
- ❌ Fail → finding ID in [findings.md](findings.md)
- ⚠️ Pass with a note or risk

## 1. Authentication and session

| ID | Scenario | Expected | Result | Run |
|---|---|---|---|---|
| TC-01 | Log in with valid credentials | Lands on the data room | ✅ | M, A `e2e/login` |
| TC-02 | Log in with a wrong password, or an unknown email | Same generic error, stays on /login | ✅ | A `api/auth`, `e2e/login` |
| TC-03 | Call protected endpoints without a token, or with a forged token | 401 | ✅ | A `api/smoke`, `api/auth` |
| TC-04 | Registration with invalid email, short password or empty name | 400 with a field message, no account created | ✅ | A `api/auth` |
| TC-05 | Register an existing email (different case) | 409 | ⚠️ R-04 (enumeration) | A `api/auth` |
| TC-06 | Sign out in tab 1, look at tab 2 | Tab 2 goes to login | ❌ F-15 | M |
| TC-07 | Reload on a deep link (`/folder/<id>`) | SPA loads, no 404 | ✅ | A `api/smoke` |

## 2. Folders

| ID | Scenario | Expected | Result | Run |
|---|---|---|---|---|
| TC-10 | Create a folder at the room root and nested 3 levels deep | Created, listed, folders before files, sorted by name | ✅ | M, A `api/folders` |
| TC-11 | Breadcrumbs from a deep folder, click an ancestor | Full trail, each crumb navigates | ✅ | M, A `api/folders` |
| TC-12 | Duplicate name among siblings: same, other case, surrounding spaces | 409 "already exists" | ✅ | X, A `api/folders` |
| TC-13 | Same name under a different parent | Allowed | ✅ | A `api/folders` |
| TC-14 | Empty / blank name, 200 chars, 201 chars | 400, 201, 400 | ✅ | X, A `api/folders` |
| TC-15 | Name with HTML `<img src=x onerror=alert(1)>` | Shown as text, no script | ✅ | M |
| TC-16 | Name with RLO `‮`, zero-width `​`, tab or newline | Rejected or normalized | ❌ F-03 | M, X, A `api/known-bugs` |
| TC-17 | Name with a NUL character | 400 | ❌ F-14 (500) | X, A `api/known-bugs` |
| TC-18 | Rename a folder; rename to a sibling's name; change only the case | 200; 409; 200 | ✅ | A `api/folders` |
| TC-19 | Delete a folder with a subtree: warning dialog | Says what will be deleted (counts + size), irreversible | ⚠️ F-20 (shares not mentioned) | M, A `api/folders` (preview) |
| TC-20 | Confirm the delete | Subtree folders and files are gone (404) | ✅ | A `api/folders` |
| TC-21 | 5–10 parallel creates of the same name | Exactly one created | ❌ F-11 | X, A `api/known-bugs` |
| TC-22 | Paging through a folder with `limit=2` | Every item once, no gaps or duplicates | ✅ | A `api/folders` |
| TC-23 | Bad pagination input (`limit` 0 or 101, garbage cursor) | 400 | ✅ | A `api/folders` |
| TC-24 | Unknown typo field `parentID` in create | 400 | ❌ F-13 (root folder created) | X |

## 3. Files

| ID | Scenario | Expected | Result | Run |
|---|---|---|---|---|
| TC-30 | Upload one PDF with the Upload button | Listed with name, size, date | ✅ | M, A `api/files` |
| TC-31 | Upload several PDFs at once | Per-file status → "Done", all listed | ✅ | M, A `e2e/owner-upload-and-view` |
| TC-32 | Upload two files with the same name in one batch | Second becomes `name (1).pdf` | ❌ F-01 | M, A `api/known-bugs` |
| TC-33 | Upload a name that already exists (sequential, any case) | `name (1).pdf`, `(2)`… | ✅ | M, A `api/files` |
| TC-34 | Upload `.txt` and `.docx` | Rejected with "X is not a PDF" | ✅ | M |
| TC-35 | Upload a 51 MB PDF | Rejected "larger than 50 MB" | ✅ | M, A `api/files` |
| TC-36 | Upload a 0-byte PDF | Clear error | ⚠️ F-06 (raw validator text) | M |
| TC-37 | Upload non-PDF bytes named `.pdf` | Rejected server-side | ❌ F-02 | M, A `api/known-bugs` |
| TC-38 | Declared size smaller than the real upload | Rejected | ❌ F-02 | X, A `api/known-bugs` |
| TC-39 | HTML content uploaded as "PDF", then opened | Not executed in the app origin | ✅ (served `text/plain`) | X |
| TC-40 | Open a PDF in the UI viewer | Renders, title shows the file name | ⚠️ F-18 (title shows UUID) | M, A `e2e/owner-upload-and-view` |
| TC-41 | Download a file | Attachment named after the file | ✅ | A `api/files` |
| TC-42 | Rename a file to an existing name | Suffix `(1)`, content still opens | ✅ | X, A `api/files` |
| TC-43 | Rename with a different / no extension (API) | Extension kept or 400 | ❌ F-04 (UI locks it, API doesn't) | X, A `api/known-bugs` |
| TC-44 | Move a file to another folder, with a name clash | Moved, renamed `(1)` | ✅ | X, A `api/files` |
| TC-45 | Delete a file | Gone, view URL 404 | ✅ | A `api/files` |
| TC-46 | Abandoned upload (never finished), then upload the same name | Original name is free | ❌ F-12 | X, A `api/known-bugs` |
| TC-47 | Reuse a signed upload URL to overwrite the file | Refused | ✅ | X |
| TC-48 | Very long name without spaces in the list | Truncated, columns stay visible | ❌ F-19 | M |

## 4. Sharing with a specific user (permissioned)

| ID | Scenario | Expected | Result | Run |
|---|---|---|---|---|
| TC-50 | Owner shares a folder with the viewer's email | Appears in the viewer's "Shared with me" | ✅ | M, A `api/access-control`, `e2e/viewer-read-only` |
| TC-51 | Viewer opens the shared folder | Read-only: no Upload, New folder or Share; file menu offers only Download | ✅ | M, A `e2e/viewer-read-only` |
| TC-52 | Viewer calls every mutation endpoint (12) | 404 for all, nothing changes | ✅ | X, A `api/access-control` |
| TC-53 | Viewer requests the parent, sibling or room by id (IDOR) | 404 | ✅ | X, A `api/access-control` |
| TC-54 | Viewer breadcrumbs inside the share | Start at the shared folder, room name hidden | ✅ | M, A `api/access-control` |
| TC-55 | Share a single file, viewer opens it and clicks Close | Back to "Shared with me" | ❌ F-16 (dead end) | M |
| TC-56 | Owner revokes while the viewer has the folder open | Next action denied, item leaves "Shared with me" | ✅ | M (two browsers), A `api/access-control` |
| TC-57 | Move a file out of the shared folder | Viewer loses access to it | ✅ | A `api/access-control` |
| TC-58 | Share again (same email, other case/spaces); share after revoke | Idempotent; new share works | ✅ | X, A `api/access-control` |
| TC-59 | Share with an invalid email / without an email | 400 | ✅ | X, A `api/access-control` |
| TC-60 | Share with your own email | Rejected | ❌ F-05 | X, A `api/known-bugs` |
| TC-61 | Share with an unregistered email | Explicit decision | ⚠️ R-01 (allowed; no email verification) | X |
| TC-62 | "Forbidden" vs "not found" responses | Indistinguishable | ❌ F-17 | X, A `api/known-bugs` |

## 5. Public links

| ID | Scenario | Expected | Result | Run |
|---|---|---|---|---|
| TC-70 | Owner creates a public link; anonymous visitor opens it | Folder and files viewable without an account | ✅ | M, A `e2e/public-link-lifecycle`, `api/public-links` |
| TC-71 | Use the link token to read the parent, sibling, room root or an outside file | 404 | ✅ | X, A `api/public-links` |
| TC-72 | File-only link | Opens that file, nothing else | ✅ | A `api/public-links` |
| TC-73 | Create a link twice (sequentially) | Same link returned | ✅ | X, A `api/public-links` |
| TC-74 | **Double-click "Create public link", then revoke** | One link; after revoke nothing opens | ❌ **F-10** | M, A `e2e/known-bug-double-click…`, `api/known-bugs` |
| TC-75 | Revoke the link | "This link has been revoked" (410) everywhere | ✅ | M, A `e2e/public-link-lifecycle`, `api/public-links` |
| TC-76 | Re-create after revoke | New token; old one stays dead | ✅ | X, A `api/public-links` |
| TC-77 | Delete the shared folder | Link stops working | ✅ | X, A `api/public-links` |
| TC-78 | Open an invalid link | Clear "not available" page | ⚠️ F-09 (useless Retry) | M |
| TC-79 | View URL obtained before revoke | Stops working | ⚠️ R-02 (valid ≤ 5 min) | X |
| TC-80 | Anonymous summary payload | No internal ids | ⚠️ F-07 (`dataRoomId`) | X |

## 6. General UI

| ID | Scenario | Expected | Result | Run |
|---|---|---|---|---|
| TC-90 | Dates and number formats in an English UI | Consistent with the UI language | ❌ F-08 | M |
| TC-91 | Empty folder | Empty state with Upload / New folder actions | ✅ | M |
| TC-92 | Narrow viewport (≈ 390 px) | No page-level horizontal scroll, actions reachable | ⚠️ F-19 | M |

---

## Totals
**68 test cases.**

| Result | Count | Notes |
|---|---|---|
| ✅ Pass | 43 | |
| ❌ Fail | 16 | 15 distinct findings: F-02 covers two cases (TC-37, TC-38) |
| ⚠️ Pass with note / risk | 9 | Minor findings and design risks |

**How they were run:**
- 29 were exercised manually in the UI.
- 26 by exploratory API probes.
- 52 are covered by automated tests.

Many cases were run more than one way. Findings not tied to a single case (for example R-03, the token lifetime) come from source review and are listed only in findings.md.
