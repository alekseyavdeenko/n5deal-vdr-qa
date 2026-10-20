import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { BUG_CHECK } from '../annotations';

const stripAnsi = (text: string) => text.replace(/\u001b\[\d+m/g, '');

/**
 * Prints one status line per known bug (tests marked test.fail() with an `issue` annotation):
 *  - "still reproduces": the test failed on its BUG_CHECK assertion - the bug is still there.
 *    The Expected/Received lines show the actual wrong behaviour.
 *  - "FAILED FOR ANOTHER REASON": the test failed somewhere else (setup, network, fixture).
 *    Playwright still counts it as "expected to fail", so without this line it would look like
 *    the bug reproduced. Investigate these.
 *  - "FIXED?": the test passed - remove test.fail() and close the finding.
 */
export default class KnownBugsReporter implements Reporter {
  private readonly lines: string[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    const issue = test.annotations.find((a) => a.type === 'issue')?.description;
    if (!issue || test.expectedStatus !== 'failed') return;

    if (result.status === 'passed') {
      this.lines.push(`  ✓ FIXED?                     ${issue}  - expected to fail but passed; remove test.fail() and close the finding`);
      return;
    }
    if (result.status !== 'failed' && result.status !== 'timedOut') return;

    const message = stripAnsi(result.errors[0]?.message ?? '');
    const lines = message.split('\n').map((l) => l.trim());
    if (message.includes(BUG_CHECK)) {
      const expected = lines.find((l) => /^(- )?Expected/.test(l)) ?? '';
      const received = lines.find((l) => /^(\+ )?Received/.test(l)) ?? '';
      this.lines.push(`  ✘ still reproduces           ${issue}\n      ${[expected, received].filter(Boolean).join('  |  ')}`);
    } else {
      this.lines.push(`  ⚠ FAILED FOR ANOTHER REASON  ${issue}\n      ${lines.find(Boolean) ?? 'no error message'}`);
    }
  }

  onEnd(_result: FullResult): void {
    if (this.lines.length === 0) return;
    console.log(`\nKnown bugs (${this.lines.length}):\n${this.lines.join('\n')}\n`);
  }
}
