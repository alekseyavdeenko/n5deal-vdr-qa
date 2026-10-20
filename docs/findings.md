**English** · [Українська](findings.uk.md)

# Bug report — Virtual Data Room

I tested the live version (commit `9c85149`) on 2026-10-20.

| | |
|---|---|
| Site | https://virtual-data-room-ten.vercel.app |
| API | https://virtual-data-room-production.up.railway.app |
| Accounts used | the owner `john@example.com`, the second user `viewer@example.com`, and one new account I registered for F-21 |

**How to read the scales:**
- **Severity** is how much damage the bug does: Critical, High, Medium, Low.
- **Priority** is how soon to fix it: High = before release, Medium = next iteration, Low = backlog.
- **"How to hit it"** tells whether a normal user can hit the bug in the UI, or only someone who calls the API directly. I checked every bug for this, and it changed several priorities.
- 🤖 means the bug has an automated test.

## Summary

21 bugs:
- 1 high priority;
- 4 medium priority;
- 16 low priority.

There are also 3 design risks.

**Most important (F-21):** if the owner shares a folder with an email that has no account yet, anyone who registers with that email first gets the folder. The app never checks that the person owns the email. I confirmed this end to end on the live site.

## All bugs, by priority

### High priority — fix before release
| ID | Bug | How to hit it | Severity | 🤖 |
|---|---|---|---|---|
| **F-21** | Anyone can take a share meant for someone else: sign up with the invited email before that person does. No email check | UI, any visitor | **Critical** | — |

### Medium priority
| ID | Bug | How to hit it | Severity | 🤖 |
|---|---|---|---|---|
| F-02 | The server does not check the uploaded file. Any content renamed to `.pdf` is stored and shown as a PDF. The 50 MB limit only checks the size the client *says*, not the real size | Content: UI (rename any file to .pdf). Size: API only | High | API |
| F-10 | Several requests at the same moment create several public links for one folder. The Share window shows only one of them, so "Revoke public link" leaves the others working | API, or a machine-speed double-click. A normal human double-click is blocked by the UI (checked by hand) | High | API + E2E |
| F-01 | If one upload contains two files with the same name, both keep that name, with no "(1)". This breaks the requirement "resolve name conflicts" | UI: select or drop two files with the same name from different folders | Medium | API |
| F-03 | Names can contain invisible and "direction-flipping" characters. `invoice‮fdp.exe` is displayed as "invoiceexe.pdf", and two folders can look exactly the same | UI (paste the name) and API | Medium | API |

### Low priority
| ID | Bug | How to hit it | 🤖 |
|---|---|---|---|
| F-11 | 5–10 requests at the same moment to create folder "X" create 5–10 folders "X" | API only. A double-click on "Create" in the UI makes one folder (checked) | API |
| F-12 | An upload that never finished still "holds" its name. The next `ghost.pdf` becomes `ghost (1).pdf` in a folder that looks empty | UI: close the tab during an upload | API |
| F-13 | Unknown fields in a request are ignored instead of rejected. A typo `targetFolderID` silently moves the file to the top level of the room | API only | API |
| F-14 | Three cases return a server error (500) instead of a normal error: a NUL character in a name, deleting the same file twice at the same moment, and "complete upload" before the file was uploaded | API only | API |
| F-04 | The API lets you rename `report.pdf` to `report.exe` or remove the extension. The UI does not allow it | API only | API |
| F-05 | The owner can share a folder with their own email. It then appears in their own "Shared with me" | UI (checked) | API |
| F-15 | After Sign out in one tab, other open tabs still show the old folder list. The first click or a refresh sends you to the login page, so no new data is shown | UI | — |
| F-16 | A viewer opens a file shared with them, refreshes the page (F5) and clicks Close (X). They get "Data room not found" instead of going back. Without the refresh, Close works fine | UI | — |
| F-17 | Error texts show whether an item exists: "Resource not found" means it exists but is not yours, "Folder not found" means it does not exist. The API docs promise they look the same | API | API |
| F-07 | The public link info returns the internal room id to anonymous visitors | API | — |
| F-06 | An empty (0 byte) PDF shows the raw technical message "size must not be less than 1" | UI | — |
| F-09 | The "Link not available" page has a Retry button that can never help | UI | — |
| F-18 | The built-in PDF viewer shows a technical id (`e247c0c7-…`) as the document title instead of the file name | UI | — |
| F-19 | On a phone-width screen, a long name without spaces makes the table wider than the screen, so the actions (⋮) are hidden. On a laptop it looks fine (checked at 1512 px) | UI, narrow screen | — |
| F-20 | The delete-folder warning does not say that the folder is shared with people or by link | UI | — |
| F-08 | Dates follow the browser language ("20 жовт. 2026 р.") while the rest of the UI is English | UI | — |

### Design risks (not bugs, but need a decision)
| ID | Risk |
|---|---|
| R-02 | A file link that a viewer already opened keeps working for up to 5 minutes after access is revoked |
| R-03 | The login token is valid for 7 days and is kept in the browser's localStorage. "Sign out" does not cancel it on the server. If the token is stolen, it works for a week |
| R-04 | There is no limit on login or sign-up attempts, so passwords can be guessed by brute force. Sign-up also says "email already exists", so anyone can check which emails have accounts. Found in the code; I did not attack the live site |

## What works well
All of this was checked, and most of it is covered by automated tests.
- **The viewer cannot change anything.** All 12 ways to change data return 404. The viewer also cannot open the owner's other folders and files by changing the id in the address (IDOR).
- **A public link shows only what was shared.** You cannot reach the parent folder, sibling folders or other files with it.
- **Revoke works at once.** The link says "This link has been revoked". If the viewer has the folder open, their next click shows "you don't have access".
- **Folders:**
  - duplicate names are blocked, ignoring capital letters and spaces;
  - the 200-character limit works;
  - the breadcrumbs (the path at the top) are correct;
  - the delete warning shows how many folders and files will be deleted.
- **Files:**
  - name conflicts get "(1)", "(2)" on upload, rename and move;
  - view and download work;
  - a download has the right file name.
- **Uploading:** wrong types and files over 50 MB are rejected with a clear message.
- **Security basics:**
  - HTML in names is shown as text, not run;
  - login gives the same message for a wrong password and an unknown email.

---

## Details of high and medium bugs

### F-21 — Anyone can take a share meant for an unregistered email
![F-21](evidence/F-21-squatter-receives-share-right-after-signup.jpg)

**Steps:**
1. The owner shares the folder "Confidential - Financials 2026" with `cfo.n5qa6468@example.com`. No account exists for this email yet, and the app allows the share.
2. Someone else opens Sign up and registers with exactly this email and any password.
3. They open "Shared with me".

**Expected:** the share reaches only the real owner of the email. For example, sign-up asks to confirm the email first, or a share to an unknown email is not allowed.

**Actual:** the account works right away, with no email confirmation. The confidential folder is already in "Shared with me" and opens.

**Why it matters:** in a deal it is normal to invite people who have no account yet, such as lawyers or auditors of the buyer. Anyone who knows or guesses their work email can get the documents first.

### F-02 — Uploaded files are not checked on the server
![F-02](evidence/F-02-F-18-fake-pdf-in-viewer-uuid-title.jpg)

**Steps:** rename any non-PDF file to `something.pdf` and upload it.

**Expected:** the server checks that the file really is a PDF (it starts with `%PDF-`) and checks its real size.

**Actual:**
- The file is saved and shown as a PDF. Viewers get "Failed to load PDF document".
- With the API you can also say "the file is 10 bytes" and then upload a bigger one. It is saved with its real size, so the 50 MB limit does not protect anything.

**Why it matters:**
- A data room should only hold real documents.
- Since anyone can sign up (see F-21), anyone can also fill the storage with big files.

### F-10 — Two public links for one folder; Revoke closes only one
![F-10](evidence/F-10-share-dialog-shows-one-of-six-active-links.jpg)

**Steps:** send two "create public link" requests for the same folder at the same moment (an automated double-click, or a script). Then click "Revoke public link" in the Share window.

**Expected:** one link per folder. After Revoke, no link works.

**Actual:**
- 2 links are created. The window shows one of them.
- After Revoke, it quietly shows the second link, which still opens the folder.
- With 6 requests at once: 6 links, and 5 still work after Revoke.

**How likely:** I clicked the button twice quickly by hand, and the UI blocked the second click. So a normal user will rarely hit this. It still matters because when it happens, the owner thinks access is closed and it is not.

**Fix idea:** allow only one active link per item in the database, and make Revoke close all of them.

### F-01 — Same-name files in one upload are not renamed
![F-01](evidence/F-01-F-06-F-08-duplicate-names-empty-file-error-local-dates.jpg)

**Steps:** in one upload, select two files called `report.pdf` from different folders (or drag them together).

**Expected:** the second becomes `report (1).pdf`, the same as when you upload them one after another.

**Actual:** both are saved as `report.pdf`, and there is no way to tell them apart.

### F-03 — Invisible and direction-flipping characters in names
![F-03](evidence/F-03-spoofed-names-and-duplicates.jpg)

**Steps:** create folders or files with these names:
- `invoice` + the right-to-left mark (U+202E) + `fdp.exe`
- `case-1` + an invisible zero-width space
- names with a tab or a line break

**Expected:** these characters are rejected or removed.

**Actual:**
- all of them are accepted;
- the first name is displayed as "invoiceexe.pdf", although it really ends with ".exe";
- two `case-1` folders look identical.

---

## Screenshots of low-priority bugs

**F-05 — the owner shares a folder with their own email** (logged in as "Viewer", sharing with viewer@example.com):

![F-05 dialog](evidence/F-05-owner-shares-with-own-email.jpg)

**F-05 — and the folder then appears in their own "Shared with me":**

![F-05 shared with me](evidence/F-05-own-folder-in-shared-with-me.jpg)

**F-06 and F-08** are on the F-01 screenshot above:
- F-06: the upload panel shows the raw text "size must not be less than 1";
- F-08: the dates are in Ukrainian.

**F-09 — "Link not available" with a Retry button that cannot help:**

![F-09](evidence/F-09-invalid-link-useless-retry.jpg)

**F-16 — Close after a refresh of the file page leads to "Data room not found":**

![F-16](evidence/F-16-close-after-refresh-dead-end.jpg)

**F-18** is on the F-02 screenshot above: the viewer's title is a technical id, not the file name.

**F-19 — on a phone (375 px) a long folder name pushes the columns and the actions (⋮) off the screen:**

![F-19](evidence/F-19-phone-width-actions-off-screen.jpg)

**F-20 — the delete warning says "2 files" but not that this folder is shared with someone:**

![F-20](evidence/F-20-delete-dialog-silent-about-sharing.jpg)

## API proof for bugs you cannot see in the UI
These are the real requests and answers from the live API on 2026-10-20. Ids are shortened.

**F-11 — 10 creates of the same folder at the same moment:**
```
POST /folders {"name":"race-dup", ...}  x10 in parallel
→ 201, 201, 201, 201, 201, 201, 201, 201, 201, 201   (10 folders "race-dup")
```

**F-12 — an upload that was never finished keeps its name:**
```
POST /files/upload-intent {"name":"ghost.pdf", ...}   → 201 {"name":"ghost.pdf"}       (file never uploaded)
POST /files/upload-intent {"name":"ghost.pdf", ...}   → 201 {"name":"ghost (1).pdf"}
GET  /folders/{id}/contents                           → {"items":[]}                  (folder looks empty)
```

**F-13 — a typo in a field name moves the file to the top of the room:**
```
PATCH /files/{id}/move {"targetFolderID":"<folder id>"}   (should be targetFolderId)
→ 200 {"folderId": null, ...}
```

**F-14 — server errors instead of normal errors:**
```
POST   /folders {"name":"nul\u0000name", ...}       → 500 {"message":"Internal server error"}
DELETE /files/{id}  x3 at the same moment           → 204, 500, 500
POST   /files/{id}/complete  (nothing uploaded)     → 500 {"message":"Could not verify the upload"}
```

**F-17 — the error text shows whether an item exists** (as the second user):
```
GET /folders/{owner's folder}/contents   → 404 {"message":"Resource not found"}
GET /folders/{random id}/contents        → 404 {"message":"Folder not found"}
```

**F-04 — the API allows another extension:**
```
PATCH /files/{id} {"name":"report.exe"}   → 200 {"name":"report.exe", "mimeType":"application/pdf"}
```

**F-07 — the public link info shows the internal room id to anyone:**
```
GET /public/{token}   (no login)
→ 200 {"resourceType":"FOLDER","resourceName":"share-root","dataRoomId":"05f75e29-…", ...}
```

## Screenshots of things that work well

**The second user sees the shared folder read-only.** There is no Upload, New folder or Share:

![read-only](evidence/OK-viewer-read-only.jpg)

**The owner revoked access while the second user had the folder open.** The next click shows a clear message:

![revoke while viewing](evidence/OK-revoke-while-viewing.jpg)

**A revoked public link shows a clear page:**

![revoked link](evidence/OK-revoked-link-page.jpg)
