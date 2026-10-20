**English** · [Українська](autotests.uk.md)

# Automated tests — catalog

There are 68 automated tests in 14 files. Every test has an ID at the start of its name, for example `FOL-03`. The same ID is used in [test-cases.md](test-cases.md) and [findings.md](findings.md).

The link also works the other way: in the code every test says which test cases (and, for known bugs, which bug) it covers. These ids show up under each test in the HTML report (`npm run report`):

```ts
test('FOL-03 folder names are unique among siblings…', covers('TC-12'), async (...) => { ... })
test('BUG-02 double-creating a public link yields one active link', knownBug('F-10', '…', 'TC-74'), async (...) => { ... })
```

## Where the tests are and where the numbers come from

| Group | ID | File | Tests |
|---|---|---|---|
| Smoke: is the site up | SMK | `tests/api/smoke.spec.ts` | 4 |
| Contract: does the API match its documentation | CON | `tests/contract/spec-drift.spec.ts` | 3 |
| Login and sign-up | AUTH | `tests/api/auth.spec.ts` | 5 |
| Folders | FOL | `tests/api/folders.spec.ts` | 10 |
| Files | FIL | `tests/api/files.spec.ts` | 7 |
| Access of the second user | ACC | `tests/api/access-control.spec.ts` | 9 |
| Public links | PUB | `tests/api/public-links.spec.ts` | 7 |
| Known bugs (expected to fail) | BUG | `tests/api/known-bugs.spec.ts` | 15 |
| Browser tests | E2E | `tests/e2e/` (6 files) | 8 |
| **Total** | | **14 files** | **68** |

| You run | You get | Why |
|---|---|---|
| `npm test` | **68** | everything |
| `npm run test:api` | **60** | all tests without a browser: SMK + CON + AUTH + FOL + FIL + ACC + PUB + BUG |
| `npm run test:api -- --grep @known-bug` | **15** | only BUG-01…BUG-15 |
| `npm run test:e2e` | **8** | only E2E-01…E2E-08 |
| `npm test -- -g "FOL-03"` | **1** | one test by its ID |

Known bugs are tested by 18 tests in total: BUG-01…BUG-15 at API level, plus E2E-06…E2E-08 in the browser.

## All tests

### SMK — smoke (`tests/api/smoke.spec.ts`)
| ID | What it checks | Covers |
|---|---|---|
| SMK-01 | The API answers `/health` with "ok" | — |
| SMK-02 | The site opens, including a direct link to a folder (no 404 on refresh) | TC-07 |
| SMK-03 | The API refuses requests without login (401) | TC-03 |
| SMK-04 | The owner can log in and has a data room | TC-01 |

### CON — contract (`tests/contract/spec-drift.spec.ts`)
| ID | What it checks | Covers |
|---|---|---|
| CON-01 | The live API has the same list of endpoints as the saved copy of its documentation | — |
| CON-02 | The live API has the same data formats as the saved copy | — |
| CON-03 | Every endpoint in the documentation describes its success answer | — |

### AUTH — login and sign-up (`tests/api/auth.spec.ts`)
| ID | What it checks | Covers |
|---|---|---|
| AUTH-01 | A wrong password and an unknown email give the same error | TC-02 |
| AUTH-02 | "Who am I" returns the logged-in user | — |
| AUTH-03 | A fake or broken token is refused | TC-03 |
| AUTH-04 | Sign-up with a wrong email, short password or empty name is refused | TC-04 |
| AUTH-05 | Sign-up with an email that already exists is refused (409) | TC-05 |

### FOL — folders (`tests/api/folders.spec.ts`)
| ID | What it checks | Covers |
|---|---|---|
| FOL-01 | Nested folders are created and listed in the right order | TC-10 |
| FOL-02 | Breadcrumbs show the full path | TC-11 |
| FOL-03 | Duplicate folder names are refused (any letter case, spaces) | TC-12 |
| FOL-04 | The same name is allowed in a different folder | TC-13 |
| FOL-05 | Name rules: not empty, trimmed, max 200 characters | TC-14 |
| FOL-06 | Rename works; a neighbour's name is refused | TC-18 |
| FOL-07 | The delete warning counts everything inside; delete removes it all | TC-19, TC-20 |
| FOL-08 | Paging through a folder returns every item once | TC-23 |
| FOL-09 | Wrong paging values are refused | TC-24 |
| FOL-10 | Unknown and broken folder ids give 404 / 400 | — |

### FIL — files (`tests/api/files.spec.ts`)
| ID | What it checks | Covers |
|---|---|---|
| FIL-01 | An uploaded PDF is listed with its real size, opens and downloads with its name | TC-30, TC-41 |
| FIL-02 | Uploading an existing name gives "(1)", "(2)" | TC-33 |
| FIL-03 | Renaming to an existing name gives "(1)"; the file still opens | TC-42 |
| FIL-04 | Moving into a folder with the same name gives "(1)" | TC-44 |
| FIL-05 | A deleted file no longer opens | TC-45 |
| FIL-06 | Upload rules: PDF only, 1 byte to 50 MB, a name is required | TC-35 |
| FIL-07 | An upload that was never finished is not shown | TC-46 |

### ACC — access of the second user (`tests/api/access-control.spec.ts`)
| ID | What it checks | Covers |
|---|---|---|
| ACC-01 | The second user can read everything inside the shared folder | TC-50 |
| ACC-02 | Their breadcrumbs start at the shared folder | TC-54 |
| ACC-03 | They cannot change anything (12 actions → 404) | TC-52 |
| ACC-04 | They cannot open anything outside the share by changing the id (IDOR) | TC-53 |
| ACC-05 | Sharing one file gives access to that file only | — |
| ACC-06 | Moving a file out of the shared folder takes away access | TC-57 |
| ACC-07 | Revoke takes away access at once | TC-56 |
| ACC-08 | Sharing again does not create duplicates; sharing after revoke works | TC-58 |
| ACC-09 | The owner sees who has access; a wrong email is refused | TC-59 |

### PUB — public links (`tests/api/public-links.spec.ts`)
| ID | What it checks | Covers |
|---|---|---|
| PUB-01 | Anyone with the link can browse the folder and open files | TC-70 |
| PUB-02 | The link cannot be used to reach the parent, neighbours or other files | TC-71 |
| PUB-03 | A link to one file opens only that file | TC-72 |
| PUB-04 | Creating a link twice returns the same link | TC-73 |
| PUB-05 | A revoked link says "revoked"; a new link gets a new address | TC-75, TC-76 |
| PUB-06 | Deleting the folder kills the link | TC-77 |
| PUB-07 | A link that does not exist gives 404 | TC-78 |

### BUG — known bugs (`tests/api/known-bugs.spec.ts`)
Each test describes the *correct* behaviour, so today it fails on purpose. The run shows it as passed ("expected to fail"). When the bug is fixed, Playwright reports it.

| ID | What it checks (correct behaviour) | Bug | Covers |
|---|---|---|---|
| BUG-01 | Same-name files uploaded together get different names | F-01 | TC-32 |
| BUG-02 | Creating a public link several times at once gives one link | F-10 | TC-74 |
| BUG-03 | Creating the same folder several times at once makes one folder | F-11 | TC-21 |
| BUG-04 | An unfinished upload does not hold its name | F-12 | TC-46 |
| BUG-05 | An unknown field in a request is refused | F-13 | — |
| BUG-06 | A NUL character in a name gives a normal error, not 500 | F-14 | TC-17 |
| BUG-07 | Deleting the same file twice at once never gives 500 | F-14 | — |
| BUG-08 | "Complete upload" before uploading gives 400, not 500 | F-14 | — |
| BUG-09 | A file that is not a real PDF is refused | F-02 | TC-37 |
| BUG-10 | The real size cannot be bigger than the stated size | F-02 | TC-38 |
| BUG-11 | Direction-flipping characters in names are refused | F-03 | TC-16 |
| BUG-12 | Rename keeps the `.pdf` extension | F-04 | TC-43 |
| BUG-13 | Sharing with your own email is refused | F-05 | TC-60 |
| BUG-14 | "Not yours" and "does not exist" give the same error | F-17 | TC-62 |
| BUG-15 | The site cannot be shown inside a frame on other sites, and the API does not reveal its server | F-27 | TC-111 |

### E2E — browser tests (`tests/e2e/`)
| ID | File | What it checks | Covers |
|---|---|---|---|
| E2E-01 | `login.spec.ts` | Login with correct data opens the data room | TC-01 |
| E2E-02 | `login.spec.ts` | A wrong password shows an error and stays on the login page | TC-02 |
| E2E-03 | `owner-upload-and-view.spec.ts` | Two PDFs uploaded at once appear and open in the viewer | TC-31, TC-40 |
| E2E-04 | `public-link-lifecycle.spec.ts` | Owner creates a link → a visitor opens it → owner revokes → visitor sees "revoked" | TC-70, TC-75 |
| E2E-05 | `viewer-read-only.spec.ts` | The second user sees the folder without Upload / New folder / Share and without Rename / Move / Delete | TC-50, TC-51 |
| E2E-06 | `known-bug-double-click-public-link.spec.ts` | A machine-speed double-click on "Create public link" gives one link (known bug, expected to fail) | F-10, TC-74 |
| E2E-07 | `known-bugs-ui.spec.ts` | After login the user lands on the page they opened by link (known bug) | F-28, TC-112 |
| E2E-08 | `known-bugs-ui.spec.ts` | Retry finishes an upload whose last step failed because of a network drop (known bug) | F-22, TC-104 |

## The framework code (`src/`)
| File | What it is |
|---|---|
| `src/api/client.ts` | One function per API endpoint, used by all API tests |
| `src/api/contract.ts` | Compares every API answer with the API documentation |
| `src/fixtures.ts` | Ready logged-in users (owner, second user, anonymous) and a fresh empty folder for each test |
| `src/ui/fixtures.ts`, `src/ui/pages/` | Browser pages for the E2E tests (page objects) |
| `src/data/factory.ts` | Unique names and a real PDF created in memory |
| `src/reporters/known-bugs-reporter.ts` | The "Known bugs" block at the end of a run |
| `global-setup.ts`, `global-teardown.ts` | Create the run folder before the tests and delete it after |
