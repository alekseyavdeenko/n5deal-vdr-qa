import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/**
 * Prints a short status line per known bug (tests marked test.fail() with an `issue` annotation):
 *  - "still reproduces" + the assertion that failed, so you can see it fails for the RIGHT reason
 *    (a known-bug test that fails because of a setup error would otherwise look identical);
 *  - "FIXED?" when the test unexpectedly passes - time to remove the marker and close the finding.
 */
export default class KnownBugsReporter implements Reporter {
  private readonly lines: string[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    const issue = test.annotations.find((a) => a.type === 'issue')?.description;
    if (!issue || test.expectedStatus !== 'failed') return;
    if (result.status === 'failed') {
      const reason = (result.errors[0]?.message ?? '').replace(/\u001b\[\d+m/g, '').split('\n').find((l) => /Expected|Received/.test(l)) ?? '';
      const received = (result.errors[0]?.message ?? '').replace(/\u001b\[\d+m/g, '').split('\n').find((l) => /^Received/.test(l.trim())) ?? '';
      this.lines.push(`  ✘ still reproduces  ${issue}\n      ${reason.trim()}${received && received !== reason ? `  |  ${received.trim()}` : ''}`);
    } else if (result.status === 'passed') {
      this.lines.push(`  ✓ FIXED?            ${issue}  - expected to fail but passed; remove test.fail() and close the finding`);
    }
  }

  onEnd(_result: FullResult): void {
    if (this.lines.length === 0) return;
    console.log(`\nKnown bugs (${this.lines.length}):\n${this.lines.join('\n')}\n`);
  }
}
