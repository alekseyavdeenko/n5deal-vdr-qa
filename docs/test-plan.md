# Test Plan — Virtual Data Room

| | |
|---|---|
| Product | [evo9/virtual-data-room](https://github.com/evo9/virtual-data-room), commit `9c85149` (2026-10-16) |
| Environments | Web https://virtual-data-room-ten.vercel.app · API https://virtual-data-room-production.up.railway.app (Swagger `/docs`) |
| Requirements | Original assignment `task.md` + product README + published OpenAPI spec |
| Time box | 24 h, one QA engineer + AI assistance |

## 1. Goal
Decide whether the MVP is safe to put in front of a real due-diligence customer. A data room is mostly about **one promise**: only the right people see the documents, and the owner can take access away. So the plan spends most of the effort on access control, sharing and revocation. Breadth comes after that.

## 2. Scope

**In scope.** All functional requirements of `task.md`:
- auth;
- folders: create, nest, rename, delete with warning, breadcrumbs;
- files: multi-upload, drag-and-drop, progress, view, rename with conflict resolution, move, delete;
- sharing: room / folder / file, public link and per-user, read-only, revoke.

On top of that: error and empty states, API contract and validation, basic security checks (IDOR, scope escape, input handling), and concurrency on create and share.

**Out of scope.** Load and stress testing, because this is a shared production deployment that other candidates use at the same time. Also out of scope: penetration testing beyond functional authorization checks, cross-browser matrix (Chromium only, plus one narrow-viewport pass), accessibility audit, and email delivery (the product has none).

## 3. Approach
- **Risk-based and gray-box.** The source code is public, so I read it first: endpoints, guards, validation, access resolution. The output is a risk map; each hypothesis is then confirmed or refuted on the live system. Code review alone is never treated as a confirmed bug.
- **Exploratory sessions by charter.** Each charter has a time box and notes. Findings are logged straight into `findings.md` with steps, expected vs actual result, impact, severity and priority.
- **Two real sessions at once.** Owner (`john@example.com`) and recipient (`viewer@example.com`) run in separate browsers. This is how "revoke while viewing" and read-only behaviour are checked.
- **Automation** goes to the scenarios where a regression would cost the most and that are stable to run against a shared environment (section 6).

## 4. Risk map and priorities

| # | Risk area | Why it matters | Likelihood | Impact | Priority |
|---|---|---|---|---|---|
| R1 | Access control: viewer read-only, no IDOR, share scope | Data leak between parties of a deal | Medium | Critical | **P1** |
| R2 | Revocation and public links: revoke really ends access, link scope cannot be escaped | The owner's main safety lever | Medium | Critical | **P1** |
| R3 | Upload integrity: PDF-only, size, content, names | Wrong or malicious files in a trusted room | High | High | **P1** |
| R4 | Concurrency: duplicate names, duplicate links | Inconsistent data, hidden extra access | High | High | **P2** |
| R5 | Folder operations: delete warning, cascade, breadcrumbs, rename conflicts | Accidental loss of documents | Medium | High | **P2** |
| R6 | Auth and session: login/logout, token lifetime, cross-tab state | Account misuse on shared machines | Medium | Medium | **P2** |
| R7 | Error handling and API robustness: 4xx vs 5xx, validation messages | Confusing UX, hidden failures | High | Medium | **P3** |
| R8 | UX polish: empty states, long names, narrow screens, i18n | Perceived quality | Medium | Low | **P3** |

How to read the table:
- **Likelihood** is how probable it is that this area hides defects. It is based on complexity and on what the code recon showed.
- **Impact** is how bad a failure there would be for the customer.
- **Priority** combines the two and sets the order of testing.

Severity is a different scale: it is used later, for each bug that was actually found.

## 5. Test charters (exploratory)

| Charter | Time box | Area |
|---|---|---|
| C1 Names and folders: limits, duplicates, Unicode, control characters, XSS | 30 min | R5, R7 |
| C2 Upload: multi-file, same names, non-PDF, 0 B, > 50 MB, fake PDF, abandoned upload | 45 min | R3, R4 |
| C3 Public links: scope escape (sibling, parent, room, foreign file), revoke, re-share, deleted target | 45 min | R2 |
| C4 Viewer: read-only on every mutation endpoint, IDOR, breadcrumbs boundary, revoke while viewing, single-file share | 45 min | R1 |
| C5 Concurrency: parallel creates, parallel links, parallel deletes | 30 min | R4 |
| C6 UI and UX: dialogs, toasts, error and empty states, long names, narrow viewport, sign-out behaviour | 45 min | R6, R8 |

## 6. Automation strategy (test pyramid)

```
          /\        UI E2E (Playwright, few)          critical journeys only
         /  \       owner upload→view · public link→revoke · viewer read-only
        /----\
       / API  \     API functional + access matrix (Playwright request)
      / tests  \    auth · folders · files · sharing · public links · validation
     /----------\
    /  contract  \  every API response validated against the published OpenAPI spec
   /--------------\
  / unit (product) \ owned by the dev team; 42 existing unit tests reviewed, gaps listed
```

- **Why mostly API.** Access-control rules live in the API. API tests are fast and deterministic, and they need no rendering, so they can check the whole role × action matrix cheaply.
- **Contract layer.** Every response the tests receive is validated against the live `/docs-json`. Contract drift (for example `Share.role` is in the README but not in the API) is caught for free.
- **Few E2E.** E2E covers only what the API cannot prove: the UI really hides edit actions, a revoked link page is shown, and a PDF renders.
- **Known bugs as `test.fail()`.** Each confirmed defect has a test that is expected to fail and links to its finding ID. The suite stays green while the bug exists and turns red the day the fix ships. That is the signal to remove the marker.
- **Isolation on a shared environment.** Each run works only inside its own uniquely named sandbox folder (`qa-<runId>`), which is deleted in global teardown. Tests never touch other users' data. Concurrency checks use a handful of requests, not load.

## 7. Entry and exit criteria
- **Entry:** both apps are reachable (`/health` 200), and the test accounts can log in.
- **Exit:**
  - every P1 and P2 charter is executed;
  - every finding is triaged with severity and priority;
  - the automated suite is green, with known bugs marked `test.fail`;
  - the QA report gives a release-readiness verdict.

## 8. Severity / priority scale
- **Severity.** Critical: data leak or loss with no workaround. High: core requirement broken or security weakness. Medium: requirement partly broken, or there is a workaround. Low: cosmetic or minor UX.
- **Priority.** High: fix before release. Medium: fix in the next iteration. Low: backlog.

## 9. Deliverables
`docs/test-plan.md` (this file) · `docs/test-cases.md` (68 executed test cases mapped to requirements) · `docs/findings.md` · `tests/` (automation framework) · `README.md` (approach, how to run, AI usage) · `docs/qa-report.md`.
