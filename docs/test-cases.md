**English** · [Українська](test-cases.uk.md)

# Test cases — Virtual Data Room

These are all the checks I ran on 2026-10-20 on the live site (commit `9c85149`), grouped like the requirements in `task.md`.

**Run:**
- **M** = by hand in the browser. The owner and the second user were logged in at the same time in two browsers.
- **X** = a direct request to the API.
- **A** = an automated test, shown by its ID (for example `FOL-03`). What each ID checks and in which file it lives is listed in [autotests.md](autotests.md). Run one test by ID: `npm test -- -g "FOL-03"`.

**Status:**
- ✅ works
- ❌ bug (the ID points to [findings.md](findings.md))
- ⚠️ works, but with a remark

## 1. Login and session

| ID | What I checked | Expected | Actual | Status | Run |
|---|---|---|---|---|---|
| TC-01 | Log in with a correct email and password | The data room opens | "My Data Room" opens with the folder list | ✅ | M, A: E2E-01, SMK-04 |
| TC-02 | Log in with a wrong password, or with an email that does not exist | The same error message for both; stay on the login page | "Invalid email or password" in both cases | ✅ | A: AUTH-01, E2E-02 |
| TC-03 | Call the API without logging in, or with a fake token | Access denied (401) | 401 | ✅ | A: SMK-03, AUTH-03 |
| TC-04 | Sign up with a wrong email, a short password or an empty name | An error that names the field; no account is created | An error that names the field | ✅ | A: AUTH-04 |
| TC-05 | Sign up with an email that already has an account (in capital letters) | Refused, without saying the account exists | 409 "already exists". Anyone can check which emails are registered | ⚠️ R-03 | A: AUTH-05 |
| TC-06 | Sign out in tab 1, then look at tab 2 | Tab 2 also goes to login | Tab 2 still shows the old folder list. The first click or a refresh sends you to login; no new data is loaded | ⚠️ F-15 | M |
| TC-07 | Refresh the page on a folder address | The app opens normally, no 404 | Opens normally | ✅ | A: SMK-02 |

## 2. Folders

| ID | What I checked | Expected | Actual | Status | Run |
|---|---|---|---|---|---|
| TC-10 | Create a folder at the top, and folders 3 levels deep | Created and listed; folders before files, sorted by name | As expected | ✅ | M, A: FOL-01 |
| TC-11 | Breadcrumbs (the path at the top) in a deep folder; click a parent | The full path; every part opens its folder | As expected | ✅ | M, A: FOL-02 |
| TC-12 | A second folder with the same name: exact, in capitals, with spaces around | Refused: "already exists" | Refused in all three cases | ✅ | X, A: FOL-03 |
| TC-13 | The same name inside a different folder | Allowed | Allowed | ✅ | A: FOL-04 |
| TC-14 | An empty name, only spaces, 200 characters, 201 characters | Error, error, OK, error | "Enter a folder name", same, created, "must be shorter than or equal to 200 characters" | ✅ | X, A: FOL-05 |
| TC-15 | The name `<img src=x onerror=alert(1)>` (an XSS attempt) | Shown as plain text, nothing runs | Shown as text | ✅ | M |
| TC-16 | Names with invisible or direction-flipping characters, a tab, a line break | Refused or cleaned | All accepted. `invoice‮fdp.exe` shows as "invoiceexe.pdf"; two `case-1` look identical | ❌ F-03 | M, X, A: BUG-11 |
| TC-17 | A name with a NUL character | A normal validation error | Server error 500 | ❌ F-14 | X, A: BUG-06 |
| TC-18 | Rename a folder; rename to a neighbour's name; change only capital letters | OK; refused; OK | As expected | ✅ | A: FOL-06 |
| TC-19 | Delete a folder with content: the warning | Says what will be deleted and that it cannot be undone | "This will permanently delete 2 subfolders and 2 files (…). This action cannot be undone." It does not say the folder is shared | ⚠️ F-20 | M, A: FOL-07 |
| TC-20 | Confirm the delete | Everything inside is gone | Folders and files inside no longer open (404) | ✅ | A: FOL-07 |
| TC-21 | Create the same folder 5–10 times at the same moment | Only one is created | API: 5–10 identical folders | ❌ F-11 | X, A: BUG-03 |
| TC-22 | Double-click "Create" in the New folder window | One folder | One folder | ✅ | M |
| TC-23 | Go through a folder page by page (2 items per page) | Every item once, nothing lost | As expected | ✅ | A: FOL-08 |
| TC-24 | Wrong paging values (0, 101, garbage) | Error 400 | 400 | ✅ | A: FOL-09 |
| TC-25 | Typo in a field name: `parentID` instead of `parentId` | Error: unknown field | The folder is created at the top of the room | ❌ F-13 | X |

## 3. Files

| ID | What I checked | Expected | Actual | Status | Run |
|---|---|---|---|---|---|
| TC-30 | Upload one PDF with the Upload button | It appears with name, size and date | As expected | ✅ | M, A: FIL-01 |
| TC-31 | Upload several PDFs at once | Each file shows its own status; all appear | "Uploading…" → "Done" for each file | ✅ | M, A: E2E-03 |
| TC-32 | Upload two files with the same name in one go | The second one gets "(1)" | Both are called `valid.pdf` | ❌ F-01 | M, A: BUG-01 |
| TC-33 | Upload a name that already exists, one after another, in different letter case | "(1)", "(2)"… | `NDA.pdf` → `nda (1).PDF` → `NDA (2).pdf` | ✅ | M, A: FIL-02 |
| TC-34 | Upload `.txt` and `.docx` | Refused with a clear reason | "2 files were rejected: notes.txt is not a PDF, doc.docx is not a PDF" | ✅ | M |
| TC-35 | Upload a 51 MB PDF | Refused | "big.pdf is larger than 50 MB". Exactly 50 MB is accepted | ✅ | M, A: FIL-06 |
| TC-36 | Upload an empty 0-byte PDF | A clear error | The raw text "size must not be less than 1" | ⚠️ F-06 | M |
| TC-37 | Upload a non-PDF file renamed to `fake.pdf` | The server refuses it | Saved and shown as a PDF; opening it shows Chrome's "Failed to load PDF document" | ❌ F-02 | M, A: BUG-09 |
| TC-38 | Through the API, say the file is 10 bytes, then upload 3 015 bytes | Refused | Accepted and saved as 3 015 bytes, so the 50 MB limit can be bypassed | ❌ F-02 | X, A: BUG-10 |
| TC-39 | Upload an HTML page named as a PDF and open it | It must not run as a web page | Storage returns it as plain text | ✅ | X |
| TC-40 | Open a PDF in the viewer | It opens; the title is the file name | Opens, but the title is a technical id (`e247c0c7-…`) | ⚠️ F-18 | M, A: E2E-03 |
| TC-41 | Download a file | It downloads with its real name | Downloads as "Q3 report.pdf" | ✅ | A: FIL-01 |
| TC-42 | Rename a file to a name that already exists | It gets "(1)", and the file still opens | `FINAL (1).pdf`, opens | ✅ | X, A: FIL-03 |
| TC-43 | Rename `report.pdf` to `report.exe` through the API | Refused, or ".pdf" is kept | Renamed to `report.exe` (the UI does not allow this) | ❌ F-04 | X, A: BUG-12 |
| TC-44 | Move a file to a folder that has a file with the same name | Moved and gets "(1)" | `term-sheet (1).pdf` | ✅ | X, A: FIL-04 |
| TC-45 | Delete a file | It is gone | It no longer opens (404) | ✅ | A: FIL-05 |
| TC-46 | Start an upload and never finish it, then upload the same name | The name is free | The new file gets "(1)" although the folder looks empty | ❌ F-12 | X, A: BUG-04, FIL-07 |
| TC-47 | Use an old upload link to overwrite a file | Refused | Refused (400) | ✅ | X |
| TC-48 | A long name without spaces in the list | The name is cut; columns and actions stay visible | Laptop (1512 px): fine. Phone width: the table is wider than the screen and the actions are hidden | ❌ F-19 | M |

## 4. Sharing with a specific person

| ID | What I checked | Expected | Actual | Status | Run |
|---|---|---|---|---|---|
| TC-50 | The owner shares a folder with the second user's email | It appears in their "Shared with me" | As expected | ✅ | M, A: ACC-01, E2E-05 |
| TC-51 | The second user opens the folder | Read only: no Upload, New folder or Share; a file menu has only Download | As expected | ✅ | M, A: E2E-05 |
| TC-52 | The second user tries all 12 ways to change data through the API | All refused, nothing changes | All 404, data unchanged | ✅ | X, A: ACC-03 |
| TC-53 | The second user changes the id in the address to open other folders, files or the room (this attack is called IDOR) | Refused | 404 in all 7 attempts | ✅ | X, A: ACC-04 |
| TC-54 | The second user's breadcrumbs | Start at the shared folder; the room name is hidden | As expected | ✅ | M, A: ACC-02 |
| TC-55 | One shared file: open it, press F5, then click Close (X) | Back to "Shared with me" | Without F5 it works. After F5: "Data room not found" | ❌ F-16 | M |
| TC-56 | The owner revokes access while the second user has the folder open | The second user loses access | The list stays until the next click, then "you don't have access"; the item leaves "Shared with me" | ✅ | M (two browsers), A: ACC-07 |
| TC-57 | Move a file out of the shared folder | The second user can no longer open it | As expected | ✅ | A: ACC-06 |
| TC-58 | Share again (same email in capitals or with spaces); share again after revoking | No duplicate; the new share works | As expected | ✅ | X, A: ACC-08 |
| TC-59 | Share with a wrong email, or with no email | Error | "Enter a valid email" | ✅ | X, A: ACC-09 |
| TC-60 | The owner shares with their own email | Refused | Done: "Shared with viewer@example.com"; it appears in their own "Shared with me" | ❌ F-05 | M, X, A: BUG-13 |
| TC-61 | **Share with an email that has no account, then someone else signs up with it** | Only the real owner of the email gets access | **A new account works without any email check, and the folder is already in its "Shared with me"** | ❌ **F-21** | M |
| TC-62 | Compare the error for "not yours" and "does not exist" | The same | "Resource not found" vs "Folder not found" | ❌ F-17 | X, A: BUG-14 |

## 5. Public links

| ID | What I checked | Expected | Actual | Status | Run |
|---|---|---|---|---|---|
| TC-70 | Create a public link and open it without an account | Folder and files can be viewed | As expected | ✅ | M, A: PUB-01, E2E-04 |
| TC-71 | Use the link to open the parent, a neighbour folder, the room or another file | Refused | 404 in all 6 attempts | ✅ | X, A: PUB-02 |
| TC-72 | A public link to one file | Only that file opens | As expected | ✅ | A: PUB-03 |
| TC-73 | Create the link twice, one after the other | The same link | The same link | ✅ | X, A: PUB-04 |
| TC-74 | **Create the link twice at the same moment, then click Revoke** | One link; nothing works after Revoke | 2 links (6 requests → 6 links, 5 still work after Revoke). By hand, a normal double-click creates only 1 | ❌ **F-10** | M, A: BUG-02, E2E-06 |
| TC-75 | Revoke the link | The visitor sees that it was revoked | "This link has been revoked" | ✅ | M, A: PUB-05, E2E-04 |
| TC-76 | Create a link again after revoking | A new link; the old one stays dead | As expected | ✅ | X, A: PUB-05 |
| TC-77 | Delete the shared folder | The link stops working | As expected | ✅ | X, A: PUB-06 |
| TC-78 | Open a link that does not exist | A clear "not available" page | Clear, but with a useless Retry button | ⚠️ F-09 | M, A: PUB-07 |
| TC-79 | A file link opened before Revoke | Stops working | Works for up to 5 more minutes | ⚠️ R-01 | X |
| TC-80 | What the public link info returns | No internal ids | Contains the room id | ⚠️ F-07 | X |

## 6. General UI

| ID | What I checked | Expected | Actual | Status | Run |
|---|---|---|---|---|---|
| TC-90 | Dates in the English interface | In the same language | In the browser language: "20 жовт. 2026 р." | ❌ F-08 | M |
| TC-91 | An empty folder | A clear empty state with buttons | "This folder is empty" + Upload / New folder | ✅ | M |
| TC-92 | A narrow (phone) screen | Nothing goes off screen | The page fits; the table goes off screen when there is a long name | ⚠️ F-19 | M |

## 7. Second round (re-checks and gaps)

| ID | What I checked | Expected | Actual | Status | Run |
|---|---|---|---|---|---|
| TC-100 | Drag two PDFs and a `.txt` from Finder into the folder with a real mouse | PDFs are uploaded, the `.txt` is not | Both PDFs are uploaded; the `.txt` did not get in | ✅ | M |
| TC-101 | Upload big files (12–45 MB) | Each file shows its own progress | Each file has its own moving progress bar (no percent number) | ✅ | M |
| TC-102 | Move a file with the Move dialog into a folder 3 levels deep | The tree opens level by level; the file moves | As expected; the current folder is disabled; "moved" message | ✅ | M |
| TC-103 | Rename with the dialog to a name that already exists | The extension stays; the conflict is explained | `.pdf` is locked; "Renamed to "big-30mb (1).pdf" to avoid a naming conflict" | ✅ | M |
| TC-104 | The connection drops at the last step of an upload, then click Retry | Retry finishes the upload | "Upload failed with status 400" on every Retry; uploading again gives `retry-test (1).pdf` | ❌ F-22 | M, A: E2E-08 |
| TC-105 | Share the whole data room with a user | The user sees all folders, read-only | Sees everything, cannot delete (404) | ✅ | X, M |
| TC-106 | How a shared room looks in "Shared with me" | Its real name and who shared it | "My Data Room", no owner | ❌ F-23 | M |
| TC-107 | Folders one inside another, 73 levels | Works, or a clear limit message | 72 levels work; level 73 → 500 | ❌ F-24 | X |
| TC-108 | A data room named with spaces only (API) | Refused | Created with an empty name | ❌ F-25 | X |
| TC-109 | A user with several data rooms | All rooms visible in "My data rooms" | Only the first room; others only by direct address | ❌ F-25 | X, M |
| TC-110 | A public link, 3 levels deep | The path is shown; Back goes one level up | No path; Back goes to the top | ❌ F-26 | M |
| TC-111 | Security headers and CORS (whether other websites can call the API) | Framing blocked, no server info, other sites blocked | CORS is fine; framing is allowed; `X-Powered-By: Express` | ❌ F-27 | X, A: BUG-15 |
| TC-112 | Open a folder link while logged out, then log in | That folder opens | The home page opens | ❌ F-28 | M, A: E2E-07 |
| TC-113 | Sign out, then log in as another user in the same tab | No data of the previous user | Nothing of the previous user is shown | ✅ | M |
| TC-114 | Keyboard: Tab to Download in "Shared with me", press Enter | Only the download starts | Only the download starts; no navigation | ✅ | M |
| TC-115 | A normal double-click with a human hand on "Create public link" | One link | One link: the button is blocked after the first click | ✅ | M |

---

## Totals
**85 checks** (69 in the first round, 16 in the second).

| Status | Count |
|---|---|
| ✅ Works | 52 |
| ❌ Bug | 24 |
| ⚠️ Remark | 9 |

**How they were run:**
- 45 checks by hand;
- 30 through the API;
- 56 have an automated test.

Many checks were done in more than one way.
