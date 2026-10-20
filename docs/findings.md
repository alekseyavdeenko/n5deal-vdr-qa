# Findings — Virtual Data Room

**Tested build:** commit `9c85149` (2026-10-16) on production:
- web: https://virtual-data-room-ten.vercel.app
- API: https://virtual-data-room-production.up.railway.app

**Accounts:** `john@example.com` (owner) and `viewer@example.com` (recipient), testing on 2026-10-20.

**Severity** is the impact on users or the business: Critical, High, Medium, Low. **Priority** is the fix order before release: High (blocker), Medium (next iteration), Low (backlog). Every finding was reproduced on the live system. Ones that have an automated reproduction are marked 🤖.

## Summary

| | High priority | Medium | Low | Total |
|---|---|---|---|---|
| Findings | 4 | 6 | 10 | **20** |
| Design risks | | | | **4** |

**The two that matter most:**
- **F-10.** The owner can believe a public link is revoked while another copy of it still works. This breaks the core promise of a data room.
- **F-02.** The server never checks what was actually uploaded, neither the content nor the size.

## Prioritized list

### High priority (fix before release)
| ID | Area | Finding | Sev. | 🤖 |
|---|---|---|---|---|
| **F-10** | Sharing | A double-click on "Create public link" creates **2 active links**. The UI shows one, and "Revoke public link" revokes only that one, so the other keeps working | High | API + E2E |
| **F-02** | Upload | File content and size are not verified server-side. Any bytes declared as `application/pdf` are stored and served as PDF, and the 50 MB limit applies only to the *declared* size | High | API |
| **F-01** | Upload | Several files with the same name in one upload batch all keep that name (no `name (1).pdf`). This violates the task.md requirement "resolve name conflicts" | Medium | API |
| **F-11** | Folders | No uniqueness under concurrency: 5–10 parallel "create folder X" requests create 5–10 folders named X | Medium | API |

### Medium priority
| ID | Area | Finding | Sev. | 🤖 |
|---|---|---|---|---|
| F-03 | Names | Bidi-override, zero-width and control characters are accepted in names. `invoice‮fdp.exe` renders as "invoiceexe.pdf", and `case-1` and `case-1​` look identical | Medium | API |
| F-15 | Session | Sign out in one tab leaves other open tabs showing the owner's folders and files | Medium | — |
| F-14 | API errors | Unhandled 500s in three places: a NUL character in a name; a parallel DELETE of the same file (1×204, 2×500); `complete` before the file reached storage | Medium | API |
| F-12 | Upload | An abandoned upload reserves its name forever: the next `ghost.pdf` becomes `ghost (1).pdf` in a folder that looks empty | Medium | API |
| F-13 | API | Unknown JSON fields are silently ignored. A typo `targetFolderID` moves the file to the **room root** with 200, and `parentID` creates a root folder | Medium | API |
| F-16 | Sharing UX | A viewer with a single-file share opens the file and clicks Close (X). They land on "Folder not found", a dead end, and the parent folder id shows in the URL | Low | — |

### Low priority
| ID | Area | Finding | 🤖 |
|---|---|---|---|
| F-04 | Files | The API lets a rename drop or change the `.pdf` extension (`report.exe`). The UI locks the extension, so only API clients are affected | API |
| F-05 | Sharing | The owner can share an item with their own email, and it then shows in their own "Shared with me" | API |
| F-17 | Security | The 404 message reveals whether an id exists: "Resource not found" (exists, forbidden) vs "Folder not found" (missing). The API docs promise these are indistinguishable | API |
| F-07 | Sharing | The anonymous public-link summary exposes the internal `dataRoomId` | — |
| F-06 | Upload UX | A 0-byte PDF fails with the raw validator text `size must not be less than 1` | — |
| F-09 | Public link UX | The "Link not available" page offers a Retry button that can never succeed | — |
| F-18 | Viewer | The embedded PDF viewer's title bar shows the storage UUID instead of the file name | — |
| F-19 | Responsive | One long name without spaces stretches the table to 1838 px; on narrow screens Size, Modified and the row actions scroll out of view | — |
| F-20 | Delete UX | The delete dialog doesn't mention that the folder is shared. Delete stays enabled when the preview request failed | — |
| F-08 | i18n | Dates follow the browser locale (`20 жовт. 2026 р.`) inside an English-only UI | — |

### Design risks (not bugs, but need a product decision)
| ID | Risk | Evidence |
|---|---|---|
| **R-01** | **Email squatting.** A share to a not-yet-registered email activates when that email registers, and registration never verifies email ownership. Whoever registers `cfo@target.com` first receives everything shared with it. | Allowed live (share to an unregistered address → 201). The behaviour is stated in the API docs ("the share applies as soon as an account with this email exists") and in the code. |
| R-02 | View and download URLs stay valid for up to 5 min after revoke or delete | A documented trade-off: a viewer who already opened a file keeps it briefly |
| R-03 | The JWT lives in `localStorage` for 7 days and cannot be revoked. Logout does not invalidate it | Any XSS means account takeover. A stolen token works for a week |
| R-04 | No rate limiting or lockout on login and registration, and registration returns 409 for existing emails | Code review (no throttler). Brute force and account enumeration are possible. Not load-tested on purpose: shared production |

## Verified OK
What a release decision can rely on. All of it is covered by the automated suite.
- **Read-only sharing is enforced server-side.**
  - A viewer gets 404 on all 12 mutation and share-management endpoints.
  - No IDOR into the parent folder, sibling folders and files, the room, or breadcrumbs above the share.
  - The viewer's breadcrumbs start at the shared folder, and the room name is hidden.
- **Public links are scoped.**
  - Parent, sibling and room-root requests, and files outside the link, all return 404.
  - A file link opens only that file.
  - Revoke → 410 "This link has been revoked" on every public endpoint.
  - Re-share issues a new token, and the old one stays dead.
  - Deleting the target kills the link.
- **Revoke while the recipient is looking:** their next click shows "…you don't have access to it", and the item disappears from "Shared with me".
- **Folders.**
  - Case-insensitive and trimmed uniqueness (409), and the 200-character limit.
  - Breadcrumbs and keyset pagination with no duplicates or gaps.
  - The delete preview counts the whole subtree, the cascade delete works, and the dialog states exactly what will be lost.
- **Files.**
  - Sequential name conflicts get `(1)`, `(2)`, …, case-insensitively, on upload, rename and move.
  - View and download work, with the download named after the file.
  - Pending uploads are invisible.
- **Upload UX.** Clear client-side rejection: "notes.txt is not a PDF", "big.pdf is larger than 50 MB". Per-file progress and status.
- **Security basics.**
  - HTML in names is escaped (no XSS).
  - HTML uploaded as "PDF" is served as `text/plain` from the storage domain.
  - A signed upload URL cannot overwrite an existing object.
  - Login returns one generic error for a wrong password and for an unknown email.
  - Forged or malformed tokens → 401.

---

## Details (high and medium priority)

### F-10 — Several active public links; revoking in the UI leaves the others working
![F-10](evidence/F-10-share-dialog-shows-one-of-six-active-links.jpg)

**Steps (UI only):**
1. As the owner, open Share for a folder.
2. **Double-click** "Create public link" and copy the link.
3. Click "Revoke public link".

**Expected:** one link per item. After revoke, the link no longer opens.

**Actual:** the double-click sends two create requests, and 2 active links exist (`GET /shares`). The dialog shows only the newest. After "Revoke public link" it silently shows the other one, which keeps working. With 6 parallel requests: 6 links; revoking in the UI leaves 5 active.

**Impact:** the owner believes access is revoked while a link already sent out still exposes the documents. "The owner can revoke access" is a core requirement in task.md.

**Cause (source):** share de-duplication is `findFirst` followed by `create`, with no unique constraint or transaction. The UI fetches only `limit=1`.

**Fix ideas:**
- add a partial unique index (one active PUBLIC_LINK per resource);
- disable the button while the request is pending;
- make "Revoke" revoke all active links of the item.

**Automated:** `tests/e2e/known-bug-double-click-public-link.spec.ts` and `tests/api/known-bugs.spec.ts`.

### F-02 — Upload content and size are not verified server-side
![F-02](evidence/F-02-F-18-fake-pdf-in-viewer-uuid-title.jpg)

**Steps:** upload `fake.pdf`, declared `application/pdf`, with content `MZ… not a pdf` (through the web app or the API).

**Expected:** the upload is rejected, for example by checking the `%PDF-` magic bytes and the stored size when `complete` is called.

**Actual:**
- **Content.** The file is stored, listed and served as `application/pdf`. The viewer then shows "Failed to load PDF document".
- **Size.** An intent declaring 10 B followed by a 3 015 B upload is accepted and stored as 3 015 B, so the 50 MB limit is bypassable by any API client.

**Impact:** arbitrary files, including executables, can be distributed through a trusted-looking data room entry, also via public links. Combined with F-03 or F-04, the name can be spoofed as well.

**Mitigating:** storage serves HTML as `text/plain`, so no stored XSS on the app origin.

### F-01 — Same-name files in one upload batch keep duplicate names
**Steps:** Upload → select two files that are both named `report.pdf` (for example, from different local folders) → upload them together.

**Expected:** the second becomes `report (1).pdf`, as for sequential uploads.

**Actual:** both are stored as `report.pdf`. The web app runs up to 4 upload intents in parallel, and the name check is not atomic.

**Impact:** two indistinguishable documents. The wrong one can be shared, moved or deleted.

### F-11 — Duplicate folders under concurrency
**Steps:** send 5–10 parallel `POST /folders` with the same name and parent. In the UI this happens with a double submit, or with two tabs or two people.

**Expected:** one 201, the rest 409.

**Actual:** every request gets 201, so 5–10 identical folders. There is no DB unique constraint on (room, parent, lower(name)).

### F-03 — Spoofing characters in names
![F-03](evidence/F-03-spoofed-names-and-duplicates.jpg)

**Steps:** create a folder, or rename a file, to `invoice‮fdp.exe`, `case-1​`, `tab\there` or `line1\nline2`.

**Actual:** all are accepted. The RLO name displays as `invoiceexe.pdf`, and two `case-1` folders look identical.

**Expected:** reject control and bidi characters, and normalize Unicode (NFC + strip zero-width) before the uniqueness check.

### F-15 — Sign out does not reach other tabs
**Steps:** open the data room in two tabs → Sign out in tab 1 → look at tab 2.

**Actual:** tab 2 keeps showing the owner's folders and files until the next request.

**Expected:** every tab returns to the login page (a `storage` event listener, or BroadcastChannel). This matters on shared or office computers.

### F-14 — Unhandled 500 errors
| Request | Actual | Expected |
|---|---|---|
| Folder name containing `\u0000` | 500 "Internal server error" | 400 validation error |
| Two or three parallel `DELETE /files/:id` | 204 + 500 + 500 | 204 + 404 + 404 |
| `POST /files/:id/complete` before the file reached storage | 500 "Could not verify the upload" | 400 "Upload did not finish" |

### F-12 — An abandoned upload reserves its name
**Steps:** start an upload of `ghost.pdf` and close the tab before it finishes (or call only `upload-intent`) → upload `ghost.pdf` again.

**Actual:** the second upload becomes `ghost (1).pdf`, although the folder looks empty. Pending rows count in the conflict check and are never cleaned up.

### F-13 — Unknown request fields are silently ignored
**Steps:** `PATCH /files/:id/move` with `{"targetFolderID": "<folder>"}` (wrong case).

**Actual:** 200, and the file is moved to the **room root**. `POST /folders` with `parentID` creates a root folder. The cause is `ValidationPipe` with `whitelist` but no `forbidNonWhitelisted`.

**Impact:** any client bug or integration typo silently moves documents to the room root.

### F-16 — Single-file share: Close leads to a dead end
**Steps:** the owner shares one file (in a non-shared folder) with the viewer → the viewer opens it from "Shared with me" → clicks the X.

**Actual:** "Folder not found. This folder does not exist, or you don't have access to it." The parent folder id is in the URL.

**Expected:** Close returns to "Shared with me".
