**English** · [Українська](README.uk.md)

# QA of the Virtual Data Room

This is my test assignment for N5Deal. I tested an existing product, the [Virtual Data Room](https://github.com/evo9/virtual-data-room) (commit `9c85149`), reported the bugs I found, and started an automated test framework.

## Documents
| What | Where |
|---|---|
| Test plan | [docs/test-plan.md](docs/test-plan.md) |
| All checks with expected and actual results (85, two rounds) | [docs/test-cases.md](docs/test-cases.md) |
| Bug report, by priority (28 bugs) | [docs/findings.md](docs/findings.md) |
| Final QA report: is it ready for release | [docs/qa-report.md](docs/qa-report.md) |
| Automated tests: all 68 with IDs, files and what each checks | [docs/autotests.md](docs/autotests.md), code in [`tests/`](tests) and [`src/`](src) |
| How I tested, how to run the tests, how I used AI | this page |

## Short result
- **Verdict: not ready yet.** One bug blocks the release.
- **The blocking bug (F-21):** if the owner shares a folder with an email that has no account yet, anyone can sign up with that email first and get the documents. I confirmed it on the live site.
- **The rest works well:**
  - the second user cannot change anything;
  - a public link shows only what was shared;
  - revoke works at once.
- **Numbers:**
  - 28 bugs: 1 high, 5 medium, 22 low priority;
  - 85 checks in two rounds;
  - 68 automated tests.

## 1. How I tested
1. **I started with the code.** The product is open source, so in the first hour I read the API documentation (32 endpoints), the access rules in the code and the existing tests. That gave me a list of places that might be broken. A place went into the bug report only after I reproduced it on the live site.
2. **I tested by hand, area by area:**
   - names and folders;
   - upload;
   - public links;
   - the second user;
   - two actions at the same moment;
   - the interface.

   The owner and the second user were logged in at the same time in two browsers, so I could revoke access while the other person was looking at the folder.
3. **I checked how a real user would hit each bug.** Some bugs only happen through the API, or after a page refresh. Those got a lower priority. For example, the "two public links" bug (F-10) looked very serious at first, but a normal double-click by hand is blocked by the interface, so it went down to medium.
4. **I automated the most important checks.** Every confirmed bug also got its own test.

The site is a shared production that other candidates use too. So I did no load testing and never changed other people's data. All my test data lived in my own folders, which I deleted at the end.

## 2. Automated tests

**Tools:** Playwright + TypeScript for both API tests and browser tests, plus Ajv to compare API answers with the API documentation.

```
          /\        Browser (8)     upload → view, public link → revoke,
         /  \                       read-only view, login, F-10, F-22, F-28
        /----\
       / API  \     API (57)        smoke, login, folders, files, access rules,
      /  tests \                    public links, 15 known bugs
     /----------\
    /  contract  \  (3 + every answer)  every API answer is compared with the API docs
   /--------------\
  /  unit (devs)   \  part of the product; I reviewed their 42 tests
 /------------------\
```

**Main ideas:**
- **Most tests are API tests.** All access rules live in the API, and API tests are fast and stable. Browser tests check only what you can see only in the UI.
- **Every API answer is checked against the API documentation.** If the API returns something the documentation does not describe, the test fails. A separate test warns when the live documentation changes.
- **Safe on a shared site:**
  - each run creates its own folder `n5qa-<date>-<code>`;
  - each test works in its own subfolder;
  - everything is deleted at the end;
  - folders left by a crashed run are removed after 2 hours.
- **Known bugs are tests too.** Each one describes the *correct* behaviour and is marked "expected to fail", so the run stays green. When a fix ships, Playwright reports "expected to fail but passed". A small custom report prints why each known bug still fails, so we know it fails for the right reason, for example `F-10: Expected 1 link, received 3`.
- **No passwords in the code.** They are read from `.env` or GitHub secrets. Tests that need a login are skipped when there is no `.env`.

### What a run looks like
A real full run on my machine (the last one, after all fixes). The "Known bugs" block at the end comes from the custom report: for each known bug it shows that the bug still happens and why (shortened):

```
$ npm test
[qa] Node 26.8.2 is not supported by Playwright yet - running on Node 22 instead.
[setup] run n5qa-20261020130030-67ti -> folder cb9844d8-…
Running 68 tests using 3 workers
  ...
[teardown] run folder deleted: 204

  68 passed (2.7m)

Known bugs (18):
  ✘ still reproduces  F-01: same-name files in one batch keep duplicate names
      Expected: 3  |  Received: 1
  ✘ still reproduces  F-10: parallel create-link requests create several active links; UI revoke closes only one
      Expected length: 1  |  Received length: 3
  ✘ still reproduces  F-11: no uniqueness under concurrency
      Expected length: 1  |  Received length: 5
  ✘ still reproduces  F-14: 500 on NUL character
      Expected: 400  |  Received: 500
  ✘ still reproduces  F-13: typo in move body moves the file to the room root
      Expected: 400  |  Received: 200
  ✘ still reproduces  F-12: pending upload intents reserve names forever
      Expected: "ghost.pdf"  |  Received: "ghost (1).pdf"
  ✘ still reproduces  F-03: RLO spoofing: invoice\u202Efdp.exe renders as invoiceexe.pdf
      Expected: 400  |  Received: 201
  ✘ still reproduces  F-02: server trusts the declared MIME type
      Expected: 400  |  Received: 201
  ✘ still reproduces  F-05: self-share appears in own "Shared with me"
      Expected: 400  |  Received: 201
  ✘ still reproduces  F-28: the link is lost after login
      Expected pattern: /\/folder\/e522d6ed-…/  |  Received string:  "https://virtual-data-room-ten.vercel.app/"
  ✘ still reproduces  F-22: Retry after a failed "complete" request never succeeds
      Expected: visible
  ...  (18 in total)
```

### How to run

```bash
npm ci
npm run install:browsers    # once: Playwright's Chromium
cp .env.example .env        # add the two test accounts from the product README
npm test                    # everything, about 3 minutes
npm run test:smoke          # quick check that the site is up
npm run test:api            # API tests
npm run test:e2e            # browser tests
npm run test:e2e:headed     # browser tests you can watch, slowed down
npm run test:known-bugs     # status of every known bug
npm run report              # HTML report
```

**Notes:**
- Playwright 1.56 supports Node 18–24. If your Node is newer (for example 26), the npm scripts run Playwright on Node 22 automatically through `scripts/pw.mjs`, so nothing hangs and nothing needs to be installed. On Node 26, do not call `npx playwright` directly: browser install, trace files and the end of the run hang there.
- Browser tests use Playwright's own Chromium. `PW_CHANNEL=chrome` switches to your installed Google Chrome.
- **CI** (`.github/workflows/qa.yml`) runs in three steps: smoke + contract → API → browser. It runs on every push and every night. The test accounts are stored as GitHub secrets.

## 3. How I used AI

I worked with Claude Code: Claude Opus as the main assistant, plus Claude Sonnet helpers for separate tasks. I used it a lot, on purpose, and checked what it did.

| What | What AI did | What I did |
|---|---|---|
| Reading the code | A helper read the product code and listed the API, the access rules and 31 suspicious places | I treated these only as ideas. A bug went into the report only after it was reproduced on the live site |
| Testing | Sent API requests and clicked through the UI in two browsers at once | I logged in to the test accounts (AI may not enter passwords), followed the testing and asked for extra checks. Example: after sign-out in one tab, I asked "what happens on refresh?", which showed F-15 is smaller than first written |
| Re-checking the bugs | Re-tested each bug the way a normal user would hit it | I did the checks that need a real person: the human double-click for F-10, and signing up with someone else's invited email for F-21 |
| Documents | Wrote the drafts | I reviewed them, asked for simpler language and set the final priorities |
| Automation | Wrote the framework and the API tests; a helper wrote the browser tests | I ran every test on my machine, including the visible browser runs, and sent back the failures |

**Where AI was wrong, and how I caught it**

AI was fast and useful, but it made mistakes regularly. My rule was simple: nothing goes into the report or the tests until it is checked on the live site, by a script, or by hand. Below are the real cases from this assignment.

**1. Bugs that AI described as worse than they really are**

| The bug, in plain words | What AI wrote first | What the re-check showed | Result |
|---|---|---|---|
| **F-15:** you sign out in one browser tab while another tab is open | "The other tab keeps showing the owner's documents after sign-out" | I asked: what happens if you refresh or click in that tab? The old list stays only until the next click. The click or a refresh sends you to the login page, and no new data is loaded | Medium → **Low** |
| **F-16:** the second user opens a file that was shared with them and clicks Close (X) | "Close always leads to a 'not found' page" | If you open the file the normal way (from "Shared with me"), Close works. It breaks only after a page refresh (F5) or when the file is opened from a direct link | Medium → **Low** |
| **F-11:** the same folder is created 10 times at the same moment | "The app creates duplicate folders" | In the UI a double-click on "Create" makes one folder. Duplicates appear only when a script sends many requests at once | High → **Low** |
| **F-19:** very long file or folder names | "Long names break the table" | On a normal laptop screen it looks fine. Only on a phone screen the table gets wider than the screen and the ⋮ button is hidden | **Low**, phone only |
| **F-10:** the owner creates a public link and later revokes it | "A double-click creates two links, so after 'Revoke' one link still works" (high priority) | I double-clicked the button by hand: it locks after the first click and creates one link. Two links appear only with requests sent at exactly the same moment (a script or a robot-speed click) | High → **Medium** |
| **F-02:** uploading a file that is not really a PDF | "Anyone can upload any file, even programs" (high priority) | Through the UI only a file renamed to `.pdf` gets in. It keeps the `.pdf` name and opens as a broken PDF. Bypassing the 50 MB limit is possible only through the API | High → **Medium** |

**2. Things AI reported that were not bugs at all**
- **"An HTML page uploaded as a PDF will run in the browser like a website."** AI expected this from reading the code. On the live site the storage returns such a file as plain text, so there is no danger. It was not put in the report.
- **"The upload panel has no progress bar, only the word Uploading."** This was the first quick check. I looked at the code and took a screenshot during a 45 MB upload: each file has its own progress bar. The requirement is met.

**3. Tests that did not test anything**
- **The "internet drop" that never happened.** To test the Retry button after a connection drop, AI first simulated the drop the wrong way: it broke one browser function, but the app sends its requests through another one (axios / XMLHttpRequest). So there was no drop at all, and the result looked like "Retry works". I made it check that the drop really happened. On the second try it did, and Retry turned out to be broken for real. That is bug F-22.
- **"Expected to fail" tests that are always green.** A test for a known bug is marked "expected to fail". It stays green whenever it fails, for any reason, even because of a mistake in the test itself. So I added a short report that shows exactly why each known bug fails, for example "Expected 1 link, received 3". This way we can see the test fails because of the bug and not because of something else.

**4. Wrong numbers and invented details**
- **Totals counted by eye.** AI wrote "75 checks" in the test-case summary, while there were 68. Since then every number in the documents is counted by a script, and every test ID in the documents is checked against the real list of tests.
- **An invented id.** In one example of an API request AI wrote an id that never appeared in a real answer. I replaced it with a placeholder. Every request and answer in the report must be real.
- **"Every requirement has an automated test."** This was not true: sharing a whole data room is not automated, because on the shared demo account it would show other people's data. The sentence was corrected and the reason was added.

**5. Fixing the symptom instead of the cause**
- **The test run sometimes never finished.** AI's first fix (turning off trace recordings) only hid the problem, and the hang came back. The real cause was Node 26, which Playwright does not support yet. Now the npm scripts run on Node 22 automatically, and the run finishes on its own.

**6. What only a human could check**
- dragging a real file from Finder into the browser;
- a real double-click with a hand (F-10);
- signing up with someone else's invited email to prove F-21.

I did these by hand.
