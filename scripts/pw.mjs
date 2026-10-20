// Runs the Playwright CLI on a Node version it supports.
// Playwright 1.56 supports Node 18-24. On newer Node (e.g. 26) browser install, trace files and
// worker shutdown hang, so on those versions this launcher runs Playwright on Node 22 via npx instead.
import { spawnSync } from 'node:child_process';

const major = Number(process.versions.node.split('.')[0]);
const args = process.argv.slice(2);
const supported = major >= 18 && major <= 24;

if (!supported) {
  console.warn(`[qa] Node ${process.versions.node} is not supported by Playwright yet - running on Node 22 instead.`);
}
const npxArgs = supported ? ['playwright', ...args] : ['-y', '-p', 'node@22', '--', 'playwright', ...args];
// A headed run is for watching: slow every action down unless SLOW_MO is set explicitly.
const env = args.includes('--headed') ? { SLOW_MO: '400', ...process.env } : process.env;
const result = spawnSync('npx', npxArgs, { stdio: 'inherit', env, shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
