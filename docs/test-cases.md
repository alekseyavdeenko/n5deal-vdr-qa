# Test Cases and Execution Log — Virtual Data Room

These are the checks executed on 2026-10-20 against production (commit `9c85149`), grouped by the requirements in `task.md`.

**Run** says how a check was executed:
- **M** = manual, in the UI. Owner and viewer were logged in at the same time in two browsers.
- **X** = exploratory API probe, from the logged-in browser session.
- **A** = automated. The column names the spec file under `tests/`.

**Status:**
- ✅ Pass
- ❌ Fail → finding ID in [findings.md](findings.md)
- ⚠️ Pass with a note or risk

## 1. Authentication and session

| ID | Scenario | Expected | Actual | Status | Run |
|---|---|---|---|---|---|
| TC-01 | Log in with valid credentials | Lands on the data room | Lands on "My Data Room" with the folder list | ✅ | M, A `e2e/login` |
| TC-02 | Log in with a wrong password, or an unknown email | Same generic error, stays on /login | 401 "Invalid email or password" in both cases; stays on /login | ✅ | A `api/auth`, `e2e/login` |
| TC-03 | Call protected endpoints without a token, or with a forged token | 401 | 401 on `/auth/me`, `/data-rooms`, `/shares/received` | ✅ | A `api/smoke`, `api/auth` |
| TC-04 | Register with an invalid email, a short password or an empty name | 400 with a field message, no account created | 400 with a message naming the field | ✅ | A `api/auth` |
| TC-05 | Register an existing email (different case) | Rejected without revealing the account exists | 409, which confirms the email is registered | ⚠️ R-04 | A `api/auth` |
| TC-06 | Sign out in tab 1, look at tab 2 | Tab 2 goes to the login page | Tab 2 keeps showing the owner's folders and files | ❌ F-15 | M |
| TC-07 | Reload on a deep link (`/folder/<id>`) | SPA loads, no 404 | 200, app loads | ✅ | A `api/smoke` |

## 2. Folders

| ID | Scenario | Expected | Actual | Status | Run |
|---|---|---|---|---|---|
| TC-10 | Create a folder at the room root, and nested 3 levels deep | Created and listed; folders before files, sorted by name | Created and listed: Alpha, beta, gamma, then files | ✅ | M, A `api/folders` |
| TC-11 | Breadcrumbs from a deep folder; click an ancestor | Full trail; each crumb navigates | Full trail "My Data Room › … › level-2"; crumbs navigate | ✅ | M, A `api/folders` |
| TC-12 | Create a sibling with the same name: same text, other case, surrounding spaces | 409 "already exists" | 409 `A folder named "…" already exists here` for all three | ✅ | X, A `api/folders` |
| TC-13 | Same name under a different parent | Allowed | 201 in both parents | ✅ | A `api/folders` |
| TC-14 | Empty / blank name; 200 chars; 201 chars | 400; 201; 400 | 400 "Enter a folder name"; 201; 400 "…shorter than or equal to 200 characters" | ✅ | X, A `api/folders` |
| TC-15 | Name with HTML `<img src=x onerror=alert(1)>` | Shown as text, no script runs | Rendered as plain text, no alert | ✅ | M |
| TC-16 | Name with RLO `‮`, zero-width `​`, tab or newline | Rejected or normalized | All accepted (201). `invoice‮fdp.exe` shows as "invoiceexe.pdf"; `case-1` and `case-1​` look identical | ❌ F-03 | M, X, A `api/known-bugs` |
| TC-17 | Name with a NUL character | 400 validation error | 500 "Internal server error" | ❌ F-14 | X, A `api/known-bugs` |
| TC-18 | Rename a folder; rename it to a sibling's name; change only the case | 200; 409; 200 | 200; 409; 200 with the new case | ✅ | A `api/folders` |
| TC-19 | Delete a folder with a subtree: warning dialog | States what will be deleted (counts + size) and that it is irreversible | "This will permanently delete N subfolders and M files (size). This action cannot be undone." Does not mention that the folder is shared | ⚠️ F-20 | M, A `api/folders` (preview) |
| TC-20 | Confirm the delete | The whole subtree is gone | 204; subfolders and files → 404 | ✅ | A `api/folders` |
| TC-21 | 5–10 parallel creates of the same name | Exactly one created, the rest 409 | All 201: 5–10 identical folders | ❌ F-11 | X, A `api/known-bugs` |
| TC-22 | Page through a folder with `limit=2` | Every item exactly once | All 6 items once, in order; last `nextCursor` null | ✅ | A `api/folders` |
| TC-23 | Bad pagination input (`limit` 0 or 101, garbage cursor) | 400 | 400 for each | ✅ | A `api/folders` |
| TC-24 | Typo in a field name: `parentID` instead of `parentId` | 400 "unknown field" | 201: the folder is created at the room root | ❌ F-13 | X |

## 3. Files

| ID | Scenario | Expected | Actual | Status | Run |
|---|---|---|---|---|---|
| TC-30 | Upload one PDF with the Upload button | Listed with name, size, date | Listed with real size (e.g. 389 B) and date | ✅ | M, A `api/files` |
| TC-31 | Upload several PDFs at once | Per-file status, all listed | Panel "Uploading…" → "Done" per file; all listed | ✅ | M, A `e2e/owner-upload-and-view` |
| TC-32 | Upload two files with the same name in one batch | Second becomes `name (1).pdf` | Both stored as `valid.pdf` | ❌ F-01 | M, A `api/known-bugs` |
| TC-33 | Upload a name that already exists (sequentially, any case) | `name (1).pdf`, `(2)`… | `NDA.pdf` → `nda (1).PDF` → `NDA (2).pdf` | ✅ | M, A `api/files` |
| TC-34 | Upload `.txt` and `.docx` | Rejected with a clear reason | Toast "2 files were rejected: notes.txt is not a PDF, doc.docx is not a PDF" | ✅ | M |
| TC-35 | Upload a 51 MB PDF | Rejected | "big.pdf is larger than 50 MB"; API: 400 for 50 MB + 1 byte, 201 for exactly 50 MB | ✅ | M, A `api/files` |
| TC-36 | Upload a 0-byte PDF | A clear, human error | Panel shows raw validator text "size must not be less than 1" | ⚠️ F-06 | M |
| TC-37 | Upload non-PDF bytes named `fake.pdf` | Rejected server-side | Stored and served as `application/pdf`; the viewer shows "Failed to load PDF document" | ❌ F-02 | M, A `api/known-bugs` |
| TC-38 | Declare 10 B at intent, upload 3 015 B | Rejected (size mismatch) | 201; stored size 3 015 B (so the 50 MB limit is bypassable) | ❌ F-02 | X, A `api/known-bugs` |
| TC-39 | HTML content uploaded as "PDF", then opened | Not executed in the app origin | Served by storage as `text/plain` on the storage domain | ✅ | X |
| TC-40 | Open a PDF in the UI viewer | Renders; title shows the file name | Renders; the viewer title shows the storage UUID (`e247c0c7-…`) instead of the name | ⚠️ F-18 | M, A `e2e/owner-upload-and-view` |
| TC-41 | Download a file | Attachment named after the file | `Content-Disposition: attachment` with "Q3 report.pdf" | ✅ | A `api/files` |
| TC-42 | Rename a file to an existing name | Suffix `(1)`; content still opens | `FINAL (1).pdf`; view URL 200 | ✅ | X, A `api/files` |
| TC-43 | Rename with another extension, or none (API) | Extension kept, or 400 | 200: renamed to `report.exe` / `noext` (the UI rename dialog locks the extension) | ❌ F-04 | X, A `api/known-bugs` |
| TC-44 | Move a file into a folder that already has that name | Moved, renamed `(1)` | Moved, renamed `term-sheet (1).pdf` | ✅ | X, A `api/files` |
| TC-45 | Delete a file | Gone | 204; then the file and its view URL → 404 | ✅ | A `api/files` |
| TC-46 | Abandon an upload (intent only), then upload the same name | Original name is free | New upload named `ghost (1).pdf` in a folder that looks empty | ❌ F-12 | X, A `api/known-bugs` |
| TC-47 | Reuse a signed upload URL to overwrite the file | Refused | 400 (upsert not allowed) | ✅ | X |
| TC-48 | Very long name without spaces in the list | Truncated; other columns stay visible | Table stretches to 1838 px in a 339 px container; Size, Modified and actions scroll out of view | ❌ F-19 | M |

## 4. Sharing with a specific user (permissioned)

| ID | Scenario | Expected | Actual | Status | Run |
|---|---|---|---|---|---|
| TC-50 | Owner shares a folder with the viewer's email | Appears in the viewer's "Shared with me" | Appears with name and date | ✅ | M, A `api/access-control`, `e2e/viewer-read-only` |
| TC-51 | Viewer opens the shared folder | Read-only: no Upload, New folder or Share; file menu = Download only | No toolbar actions; row menu offers Download only | ✅ | M, A `e2e/viewer-read-only` |
| TC-52 | Viewer calls every mutation endpoint (12) | 404 for all, nothing changes | 404 × 12; owner's data unchanged | ✅ | X, A `api/access-control` |
| TC-53 | Viewer requests the parent, sibling or room by id (IDOR) | 404 | 404 for all 7 attempts | ✅ | X, A `api/access-control` |
| TC-54 | Viewer breadcrumbs inside the share | Start at the shared folder; room name hidden | "Shared with me › viewer-shared › viewer-sub"; `dataRoomName: null` | ✅ | M, A `api/access-control` |
| TC-55 | Share a single file; the viewer opens it and clicks Close (X) | Back to "Shared with me" | "Folder not found … or you don't have access to it"; parent folder id in the URL | ❌ F-16 | M |
| TC-56 | Owner revokes while the viewer has the folder open | Next action denied; item leaves "Shared with me" | List stays until the next click, then "File not found … or you don't have access to it"; item gone from the list | ✅ | M (two browsers), A `api/access-control` |
| TC-57 | Move a file out of the shared folder | Viewer loses access to it | 200 → 404 for the viewer | ✅ | A `api/access-control` |
| TC-58 | Share again (same email, other case or spaces); share again after revoke | Same share returned; new share works | Same share id returned; after revoke a new id and access restored | ✅ | X, A `api/access-control` |
| TC-59 | Share with an invalid email, or without an email | 400 | 400 "Enter a valid email" / 400 | ✅ | X, A `api/access-control` |
| TC-60 | Share with your own email | Rejected | 201; the folder shows in the owner's own "Shared with me" | ❌ F-05 | X, A `api/known-bugs` |
| TC-61 | Share with an unregistered email | An explicit product decision | 201; the share activates for whoever registers that email (no verification) | ⚠️ R-01 | X |
| TC-62 | Compare "forbidden" and "not found" responses | Indistinguishable | "Resource not found" vs "Folder not found" | ❌ F-17 | X, A `api/known-bugs` |

## 5. Public links

| ID | Scenario | Expected | Actual | Status | Run |
|---|---|---|---|---|---|
| TC-70 | Owner creates a public link; an anonymous visitor opens it | Folder and files viewable without an account | Visitor sees the folder, opens the PDF | ✅ | M, A `e2e/public-link-lifecycle`, `api/public-links` |
| TC-71 | Use the token to read the parent, sibling, room root or an outside file | 404 | 404 for all 6 attempts | ✅ | X, A `api/public-links` |
| TC-72 | File-only link | Opens that file, nothing else | File opens; its folder and other files → 404 | ✅ | A `api/public-links` |
| TC-73 | Create a link twice (sequentially) | Same link returned | Same token; one active link | ✅ | X, A `api/public-links` |
| TC-74 | **Double-click "Create public link", then revoke** | One link; after revoke nothing opens | 2 active links; the dialog shows one; after revoke it shows the other, which still works (6 parallel requests → 5 survive revoke) | ❌ **F-10** | M, A `e2e/known-bug-double-click…`, `api/known-bugs` |
| TC-75 | Revoke the link | Visitor is told it's revoked | 410 "This link has been revoked" on every public endpoint; page shows the same | ✅ | M, A `e2e/public-link-lifecycle`, `api/public-links` |
| TC-76 | Create again after revoke | New token; old one stays dead | New token works; old one stays 410 | ✅ | X, A `api/public-links` |
| TC-77 | Delete the shared folder | Link stops working | 404 "Folder not found" | ✅ | X, A `api/public-links` |
| TC-78 | Open an invalid link | Clear "not available" page | "Link not available …" plus a Retry button that can never succeed | ⚠️ F-09 | M |
| TC-79 | Use a view URL obtained before the revoke | Stops working | Still 200 (valid up to 5 minutes) | ⚠️ R-02 | X |
| TC-80 | Anonymous summary payload | No internal ids | Includes `dataRoomId` | ⚠️ F-07 | X |

## 6. General UI

| ID | Scenario | Expected | Actual | Status | Run |
|---|---|---|---|---|---|
| TC-90 | Dates in the English UI | Match the UI language | Browser locale: "20 жовт. 2026 р." | ❌ F-08 | M |
| TC-91 | Empty folder | Empty state with actions | "This folder is empty" + Upload / New folder | ✅ | M |
| TC-92 | Narrow viewport (≈ 390 px) | No horizontal page scroll; actions reachable | Page itself fits; the table scrolls sideways when a long name is present | ⚠️ F-19 | M |

---

## Totals
**68 test cases.**

| Status | Count | Notes |
|---|---|---|
| ✅ Pass | 43 | |
| ❌ Fail | 16 | 15 distinct findings: F-02 covers two cases (TC-37, TC-38) |
| ⚠️ Pass with note / risk | 9 | Minor findings and design risks |

**How they were run:**
- 29 were exercised manually in the UI.
- 26 by exploratory API probes.
- 52 are covered by automated tests.

Many cases were run more than one way. Findings not tied to a single case (for example R-03, the token lifetime) come from source review and are listed only in findings.md.
