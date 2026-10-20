import { covers } from '../../src/annotations';
import { ApiClient, errorMessage } from '../../src/api/client';
import { credentials, hasCredentials } from '../../src/config';
import { expect, test } from '../../src/fixtures';

test.describe('auth', () => {
  test('AUTH-01 login rejects a wrong password and an unknown email with the same generic message', covers('TC-02'), async ({ anonApi }) => {
    test.skip(!hasCredentials('owner'), 'OWNER_EMAIL / OWNER_PASSWORD not set in .env');
    const { email } = credentials('owner');
    const wrongPassword = await anonApi.login({ email, password: 'definitely-wrong-password' });
    const unknownEmail = await anonApi.login({ email: `nobody-${Date.now()}@example.invalid`, password: 'whatever-123' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(errorMessage(wrongPassword.body)).toBe(errorMessage(unknownEmail.body)); // no account enumeration via login
  });

  test('AUTH-02 /auth/me returns the logged-in user with a lowercase email', async ({ ownerApi }) => {
    const me = await ownerApi.me();
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(credentials('owner').email.trim().toLowerCase());
  });

  test('AUTH-03 a malformed or forged token is rejected', covers('TC-03'), async ({ apiContext }) => {
    for (const token of ['not-a-jwt', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalid-signature']) {
      const res = await new ApiClient(apiContext, token).me();
      expect(res.status, token).toBe(401);
    }
  });

  test('AUTH-04 registration validates input before creating anything', covers('TC-04'), async ({ anonApi }) => {
    const cases = [
      { body: { name: 'QA', email: 'not-an-email', password: 'long-enough-1' }, field: 'email' },
      { body: { name: 'QA', email: `n5qa-${Date.now()}@example.invalid`, password: 'short' }, field: 'password' },
      { body: { name: '', email: `n5qa-${Date.now()}@example.invalid`, password: 'long-enough-1' }, field: 'name' },
    ];
    for (const { body, field } of cases) {
      const res = await anonApi.register(body);
      expect(res.status, field).toBe(400);
      expect(errorMessage(res.body).toLowerCase(), field).toContain(field === 'name' ? 'name' : field);
    }
  });

  test('AUTH-05 registering an existing email is refused with 409', covers('TC-05'), async ({ anonApi }) => {
    test.skip(!hasCredentials('owner'), 'OWNER_EMAIL / OWNER_PASSWORD not set in .env');
    const res = await anonApi.register({ name: 'Duplicate', email: credentials('owner').email.toUpperCase(), password: 'long-enough-1' });
    expect(res.status).toBe(409);
  });
});
