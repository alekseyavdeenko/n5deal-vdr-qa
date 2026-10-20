**English** · [Українська](test-plan.uk.md)

# Test plan — Virtual Data Room

| | |
|---|---|
| Product | [evo9/virtual-data-room](https://github.com/evo9/virtual-data-room), commit `9c85149` |
| Where | Site https://virtual-data-room-ten.vercel.app, API https://virtual-data-room-production.up.railway.app |
| Requirements | `task.md` in the product repo, the product README and the API documentation (`/docs`) |
| Time | 24 hours, one tester, with AI help |

## 1. Goal
Find out if this product can be given to a real customer for a company deal.

A data room has one main job: only the right people see the documents, and the owner can take access away. So I spent most of the time on sharing and access, and less on everything else.

## 2. What I test and what I don't

**I test** everything from `task.md`:
- login and sign-up;
- folders: create, nest, rename, delete with a warning, breadcrumbs;
- files: upload several at once, view, rename, move, delete;
- sharing: a whole room, a folder or one file, by public link or with a specific person, and revoke.

**I also test:**
- errors and empty states;
- the API;
- basic security: can someone open what is not theirs;
- what happens when two actions happen at the same moment.

**I don't test, and why:**
- **Load and stress:** the site is a shared production that other candidates use right now.
- **Real hacking:** brute force and attacks are out of scope; I only check the rules.
- **Many browsers:** Chrome only.
- **Accessibility:** no time in 24 h.

## 3. How I test
1. **First I read the code and the API docs** (about 1 hour). The product is open source, so I listed all 32 API endpoints, the access rules and the existing tests. This gave me a list of places that *might* be broken. Nothing goes into the bug report until I reproduce it on the live site.
2. **Then I test by hand, area by area** (the list is below). The owner and the second user are logged in at the same time in two browsers, so I can see what the other person sees.
3. **For every bug I check how a real user would hit it.** Some bugs only happen through the API, or only after a refresh. Then I give them a lower priority. For example, F-10 went from High to Medium after I tried a normal double-click by hand.
4. **I automate the most important checks**, plus a test for every confirmed bug.

## 4. Risk areas
For each area I estimate two things:
- **Likelihood:** how likely there are bugs there (based on how complex it is and what I saw in the code);
- **Impact:** how bad a bug there would be for the customer.

The more of both, the earlier I test the area. Severity is a different thing: it is set later, for each bug found.

| # | Area | Likelihood | Impact | Order |
|---|---|---|---|---|
| R1 | Access: the second user is read-only and cannot open what is not shared | Medium | Critical | 1 |
| R2 | Public links and revoke | Medium | Critical | 1 |
| R3 | Upload: only real PDFs, size limit, names | High | High | 1 |
| R4 | Two actions at the same moment (duplicates) | High | High | 2 |
| R5 | Folders: delete warning, nested delete, breadcrumbs | Medium | High | 2 |
| R6 | Login, sign-up, logout | Medium | Medium | 2 |
| R7 | Error messages and API errors | High | Medium | 3 |
| R8 | Look and feel: long names, phone screen, language | Medium | Low | 3 |

## 5. Test sessions (by hand)
| Session | Time | What I look at |
|---|---|---|
| S1 Names and folders | 30 min | Limits, duplicates, special characters, HTML in names |
| S2 Upload | 45 min | Several files, same names, not a PDF, empty file, over 50 MB, fake PDF, upload that never finished |
| S3 Public links | 45 min | Escaping outside the shared folder, revoke, new link, deleted folder |
| S4 The second user | 45 min | Read-only on every action, opening other ids, breadcrumbs, revoke while viewing, one shared file |
| S5 Same moment | 30 min | Two creates, two links, two deletes at once |
| S6 Interface | 45 min | Windows, messages, errors, long names, phone screen, sign-out in two tabs |

The result of every check is in [test-cases.md](test-cases.md), and the bugs are in [findings.md](findings.md).

## 6. Automation plan (test pyramid)

```
          /\        Browser tests (few)      - only what needs the real UI
         /  \       upload → view, public link → revoke, read-only view, login
        /----\
       / API  \     API tests (most)         - all rules: folders, files, access,
      / tests  \                               links, + one test per confirmed bug
     /----------\
    /  contract  \   every API answer is compared with the official API description
   /--------------\
  /   unit tests   \  part of the product code - the developers' job
 /------------------\ (I reviewed their 42 tests and listed what is missing)
```

- **Most tests are API tests.** All access rules live in the API, and API tests are fast and stable.
- **Few browser tests:** only what you can see only in the UI, for example hidden buttons and the revoked page.
- **A test for every known bug.** It describes the *correct* behaviour and is marked "expected to fail". When the developers fix the bug, the test reports it.
- **Safe for the shared site.** Each run creates its own folder and deletes it at the end. It never touches other people's data.

## 7. When to start and when testing is done
**Start:** the site and API are up, and the test accounts can log in.

**Done when:**
- all sessions are finished;
- every bug has a severity and a priority;
- the automated tests pass (known bugs fail as expected);
- the QA report says whether the product is ready.

## 8. Severity and priority
- **Severity:**
  - Critical: data leak or loss with no workaround;
  - High: a main requirement is broken, or a security weakness;
  - Medium: partly broken, or there is a workaround;
  - Low: cosmetic or small.
- **Priority:** High = fix before release, Medium = next iteration, Low = backlog.

## 9. What I deliver
- this plan;
- [test-cases.md](test-cases.md) (all checks with results);
- [findings.md](findings.md) (bugs);
- automated tests in `tests/`;
- [README](../README.md) (how it works and how to run it);
- [qa-report.md](qa-report.md) (final report).
