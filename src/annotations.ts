import type { TestDetails } from '@playwright/test';

/**
 * Links a test to the test cases it automates (docs/test-cases.md).
 * Usage: test('FOL-03 …', covers('TC-12'), async () => { … })
 * The ids are shown under the test in the HTML report.
 */
export function covers(...testCases: string[]): TestDetails {
  return { annotation: testCases.map((id) => ({ type: 'test case', description: id })) };
}

/**
 * Message for the ONE assertion in a known-bug test that checks the bug itself:
 *   expect(res.status, BUG_CHECK).toBe(400)
 * The known-bugs reporter only says "still reproduces" when the failure carries this message;
 * any other failure (setup, network, fixture) is reported as "failed for another reason".
 */
export const BUG_CHECK = 'known-bug check';

/**
 * Marks a known-bug test: the finding it reproduces (docs/findings.md) and the test cases it covers.
 * The "issue" annotation is also read by src/reporters/known-bugs-reporter.ts.
 */
export function knownBug(finding: string, description: string, ...testCases: string[]): TestDetails {
  return {
    annotation: [
      { type: 'issue', description: `${finding}: ${description}` },
      ...testCases.map((id) => ({ type: 'test case', description: id })),
    ],
  };
}
