import 'dotenv/config';

export type Role = 'owner' | 'viewer';

export interface Credentials {
  email: string;
  password: string;
}

export const config = {
  webUrl: (process.env.WEB_URL ?? 'https://virtual-data-room-ten.vercel.app').replace(/\/$/, ''),
  apiUrl: (process.env.API_URL ?? 'https://virtual-data-room-production.up.railway.app').replace(/\/$/, ''),
  /** Contract violations fail the test by default; set CONTRACT_STRICT=false to only log them. */
  contractStrict: process.env.CONTRACT_STRICT !== 'false',
};

/** Read lazily so suites that need no login (health, public links, contract drift) run without a .env. */
export function credentials(role: Role): Credentials {
  const prefix = role.toUpperCase();
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) {
    throw new Error(`Missing ${prefix}_EMAIL / ${prefix}_PASSWORD. Copy .env.example to .env and fill in the test accounts.`);
  }
  return { email, password };
}

export function hasCredentials(role: Role): boolean {
  const prefix = role.toUpperCase();
  return Boolean(process.env[`${prefix}_EMAIL`] && process.env[`${prefix}_PASSWORD`]);
}

/**
 * Unique id of this test run. Set by global-setup (inherited by workers) so every
 * artefact a run creates can be found - and cleaned up - by name.
 */
export function runId(): string {
  if (!process.env.QA_RUN_ID) {
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    process.env.QA_RUN_ID = `n5qa-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return process.env.QA_RUN_ID;
}
