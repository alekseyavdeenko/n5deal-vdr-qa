# QA of the Virtual Data Room

Product QA assignment for N5Deal: test the existing [Virtual Data Room](https://github.com/evo9/virtual-data-room) (commit `9c85149`), report findings, and lay the foundation of a reusable automation framework.

| Deliverable | Where |
|---|---|
| Test plan | [docs/test-plan.md](docs/test-plan.md) |
| Test cases + execution log (manual, exploratory, automated) | [docs/test-cases.md](docs/test-cases.md) |
| Prioritized findings report | [docs/findings.md](docs/findings.md) |
| Final QA report (release readiness) | [docs/qa-report.md](docs/qa-report.md) |
| Automated tests and framework | [`src/`](src) + [`tests/`](tests), CI in [`.github/workflows/qa.yml`](.github/workflows/qa.yml) |
| Testing approach | this README, section 1 |
| AI usage | this README, section 4 |

---

## 1. Testing approach

**Start from what a data room promises.** A data room exists so the right people see the documents and the owner can take access away. Almost all the risk sits in access control, sharing and revocation, so most of the effort went there. Breadth came second. The full risk map is in the test plan.

1. **Gray-box recon (about 1 h).** The product is open source, so before clicking anything I mapped:
   - all 32 endpoints from the live OpenAPI spec;
   - the auth guard, validation rules and access-resolution logic in the code;
   - the 42 existing unit tests and their gaps.

   The output was a list of hypotheses, not bugs. A code smell counts as a finding only after it reproduces on the live system.
2. **Exploratory testing by charters.** Six time-boxed charters:
   - names and folders;
   - upload;
   - public links;
   - viewer and IDOR;
   - concurrency;
   - UI and UX.

   Owner and recipient were logged in at the same time in two browsers, so "revoke while the other person is looking" was tested for real.
3. **Prioritize by impact on the core promise.** Each finding gets severity (impact) and priority (fix order). The headline bug (F-10) is ranked first because it silently breaks revocation. Its count of HTTP calls doesn't matter.
4. **Automate where a regression would hurt most.** Each confirmed defect also becomes an executable test, so the findings report is verifiable rather than only descriptive.

The target is a **shared production deployment**, also used by other candidates at the same time. So there was no load testing, nothing outside my own sandbox folder was modified, and every automated run creates and deletes its own data.

## 2. Automation framework

**Stack:** Playwright Test + TypeScript, used for both API and browser tests (one runner, one report), plus Ajv for contract validation.

```
            ┌──────────────┐
            │  UI E2E (6)  │  journeys only the UI can prove: upload→view, public link→revoke,
            ├──────────────┤  viewer read-only, login, F-10 double-click
            │  API (56)    │  smoke · auth · folders · files · access-control matrix ·
            │              │  public links · 14 known-bug tests
            ├──────────────┤
            │ contract (3) │  live OpenAPI == committed snapshot; and EVERY API response in
            │  + per-call  │  every test is validated against that spec
            ├──────────────┤
            │ unit (product)│ owned by the dev team - existing 42 reviewed, gaps listed in the QA report
            └──────────────┘
```

### Design decisions
- **API-heavy pyramid.** The authorization rules live in the API. API tests check the full role × action matrix in seconds and are deterministic. E2E covers only what the API cannot prove.
- **Contract checking is built into the client.** `src/api/client.ts` validates every response against `docs/reference/openapi.json`, including the status code. A test fails if the API returns something its own docs don't describe. `tests/contract/spec-drift.spec.ts` fails when the deployed spec changes, so the snapshot is updated on purpose rather than drifting.
- **Isolation on a shared environment.**
  - `global-setup` creates one run folder `n5qa-<timestamp>-<id>`.
  - Each test gets a fresh `testFolder` inside it.
  - `global-teardown` deletes the run folder (cascade).
  - Run folders left behind by crashed runs are swept after 2 h.
  - No test touches anything else in the account.
- **Known bugs as `test.fail()` with an `issue` annotation.** Each test is written as the *correct* behaviour.
  - Today it fails, and the suite stays green.
  - When the fix ships, Playwright reports "expected to fail but passed".
  - A custom reporter (`src/reporters/known-bugs-reporter.ts`) prints, for every known bug, the assertion that failed. That proves it fails *for the right reason*, for example `F-10 … Expected length: 1 | Received length: 3`.
- **Credentials only from `.env` / CI secrets, read lazily.**
  - Suites that need no login (smoke, contract, public pages) run without them.
  - Tests that need a role skip with a clear reason.
  - E2E logs in by injecting the API token into `localStorage`, so the UI login form is tested once instead of on every test.
- **Readable layers:**
  - `ApiClient`, a typed method per endpoint that never throws on HTTP errors;
  - fixtures (`ownerApi`, `viewerApi`, `anonApi`, `testFolder`, `ownerPage`, `viewerPage`, `anonPage`);
  - page objects in `src/ui/pages`;
  - a data factory (`uniqueName`, `makePdf`, which builds a valid PDF in memory, so no binary fixtures).

### Run it

```bash
npm ci
cp .env.example .env        # fill in the two test accounts from the product README
npm test                    # everything (≈ 3 min)
npm run test:smoke          # reachability + login, seconds
npm run test:api            # API + contract layers
npm run test:e2e            # browser journeys (local: installed Google Chrome; CI: bundled Chromium)
npm run test:e2e:headed     # watch them run, slowed down
npx playwright test --grep @known-bug   # status of every confirmed defect
npm run report              # HTML report
```

| Variable | Default | Purpose |
|---|---|---|
| `KEEP_TEST_DATA` | unset | Set to `true` to skip teardown and inspect the data |
| `CONTRACT_STRICT` | unset | Set to `false` to log contract violations instead of failing |
| `PW_CHANNEL` | — | Choose the browser |
| `API_URL`, `WEB_URL` | — | Point the suite at another environment |

**Requirements:** use Node 22 (`.nvmrc`). On Node 26, Playwright's zip handling hangs (browser install, trace archives), so traces are enabled only in CI.

**CI** (`.github/workflows/qa.yml`) has three jobs: smoke + contract → API → E2E. It runs on push and PR, and nightly against the deployment. HTML reports are uploaded as artifacts. Credentials come from repository secrets.

## 3. Results at a glance

**Findings:** 20 findings and 4 design risks. Details in [docs/findings.md](docs/findings.md).
- High priority: 4, among them F-10 (revocation can be bypassed) and F-02 (no file content or size validation).

**Automated suite:** 65 tests.
- 50 regression checks pass.
- 15 known-bug tests reproduce their defect: 14 at API level and 1 in the UI.

**Verdict:** not ready for a real due-diligence customer until F-10 and F-02 are fixed. The rest is in good shape. See [docs/qa-report.md](docs/qa-report.md).

## 4. Where and how AI was used

I worked with Claude Code (Opus 5.5 as the main session, plus Sonnet 5.5 sub-agents for scoped tasks). AI was used heavily, by choice. It was always steered and checked.

| Activity | What AI did | What I did / how it was checked |
|---|---|---|
| Recon | A sub-agent read the product source and produced an endpoint map, the access rules and 31 "suspicious spots" with file:line references | Treated as hypotheses only. Every item in the findings report was reproduced on the live system; unconfirmed ones are labelled "from source review" |
| Exploratory testing | Ran API probes in the logged-in browser session (validation edges, races, scope escapes) and drove the UI in two browsers at once | I logged in the test accounts (the AI is not allowed to enter passwords), followed the sessions live, and reviewed every finding against the product requirements |
| Test plan, findings, report | Drafted the documents | Reviewed and edited by me; final severity and priority calls are mine |
| Framework | Wrote the core (client, contract validation, fixtures, reporter) and the API specs; a sub-agent wrote the E2E page objects and specs | I ran every suite on my machine (including headed E2E runs) and fed the failures back |

**Where the AI was wrong or needed correcting:**
- **The task.** It first read the original product assignment (`task.md`) as something I had to *build*. The recruiter's message corrected the scope.
- **"Bugs" from code reading.** Several items in the source review were not bugs. For example, the HTML-as-PDF stored-XSS idea does not reproduce, because storage serves the file as `text/plain`. They were kept out of the bug list.
- **Tests that pass for the wrong reason.** A known-bug test marked `test.fail()` passes whenever it fails *for any reason*. This led to adding the known-bugs reporter, which shows the actual failing assertion.
- **Tooling on Node 26.** The browser download and trace zipping hung. The workaround (system Chrome locally, traces only in CI) was confirmed by re-running.
