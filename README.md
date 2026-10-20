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

**Where AI was wrong:**
- **The task itself.** At first it read the product's original assignment (`task.md`) as something I had to *build*. The recruiter's message corrected this.
- **Ideas from reading the code that were not real bugs.** For example, it suspected that an HTML page uploaded as a PDF would run as a web page, but storage returns it as plain text. Ideas like this were not put in the report.
- **Priorities that were too high.** The first draft rated F-10, F-02 and F-15 as more serious than they are. They were lowered after re-checking how a real user would hit them.
- **Tests that pass for the wrong reason.** A test marked "expected to fail" passes whenever it fails, for any reason. This is why the custom known-bug report was added.
