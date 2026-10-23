import { test, expect } from '..\\..\\fixtures\\test';
import { newUserData } from '..\\..\\helpers\\test-data';
import type { AuthResponse, ErrorResponse, UserResponse } from '..\\..\\types\\api';

test('API-01 | Successful registration returns initial user values', async ({ scenario }) => {
  const data = newUserData();
  const response = await test.step('Register a new user with unique credentials', async () => {
    const response = await scenario.api.auth.register(data);
    expect(response.status(), 'POST /auth/register').toBe(201);
    return response;
  });

  await test.step('Verify identity, initial statistics and absence of password fields', async () => {
    const body: UserResponse = await response.json();
    expect(Number.isSafeInteger(body.id) && body.id > 0, 'User ID must be a positive integer')
      .toBe(true);
    expect(body.username).toBe(data.username);
    expect(body.email).toBe(data.email);
    expect(body.role).toBe('USER');
    expect(body.active).toBe(true);
    expect(body.wins).toBe(0);
    expect(body.losses).toBe(0);
    expect(body.rating).toBe(1000);
    expect(typeof body.createdAt).toBe('string');
    expect(Number.isFinite(Date.parse(body.createdAt)), 'createdAt must be a valid timestamp')
      .toBe(true);
    expect(Object.hasOwn(body, 'password'), 'Password must not be exposed').toBe(false);
    expect(Object.hasOwn(body, 'passwordHash'), 'Password hash must not be exposed').toBe(false);
  });
});

test('API-02 | Registration rejects an already registered email', async ({ scenario }) => {
  const existing = await test.step('Register the original user', () => scenario.registerUser());
  const duplicate = { ...newUserData(), email: existing.data.email };

  await test.step('Register a different username with the same email', async () => {
    expect(duplicate.username).not.toBe(existing.data.username);
    const response = await scenario.api.auth.register(duplicate);
    expect(response.status(), 'POST /auth/register with a duplicate email').toBe(409);
    const body: ErrorResponse = await response.json();
    expect(body.message).toBe(`Email is already registered: ${existing.data.email}`);
    expect(Object.hasOwn(body, 'id'), 'A rejected registration must not return a new user').toBe(false);
    expect(Object.hasOwn(body, 'token'), 'A rejected registration must not return a token').toBe(false);
  });
});

test('API-03 | Login returns a usable token for the same user', async ({ scenario }) => {
  const user = await test.step('Register the user without signing in', () => scenario.registerUser());
  const token = await test.step('Log in and verify the returned identity', async () => {
    const response = await scenario.api.auth.login({
      email: user.data.email,
      password: user.data.password,
    });
    expect(response.status(), 'POST /auth/login').toBe(200);
    const body: AuthResponse = await response.json();
    expect(typeof body.token, 'Login token must be a string').toBe('string');
    expect(body.token.trim().length > 0, 'Login token must not be empty').toBe(true);
    expect(body.username).toBe(user.data.username);
    expect(body.email).toBe(user.data.email);
    expect(body.role).toBe('USER');
    return body.token;
  });

  await test.step('Use the token on the protected current-user endpoint', async () => {
    const authenticated = await scenario.apiForToken(token);
    const response = await authenticated.auth.me();
    expect(response.status(), 'GET /auth/me with the returned bearer token').toBe(200);
    const body: UserResponse = await response.json();
    expect(body.id).toBe(user.profile.id);
    expect(body.username).toBe(user.data.username);
    expect(body.email).toBe(user.data.email);
    expect(body.role).toBe('USER');
  });
});

test('API-04 | Login rejects an incorrect password', async ({ scenario }) => {
  const user = await test.step('Register a user with a known password', () => scenario.registerUser());

  await test.step('Submit a valid login payload with a different password', async () => {
    const response = await scenario.api.auth.login({
      email: user.data.email,
      password: `${user.data.password}_wrong`,
    });
    expect(response.status(), 'POST /auth/login with an incorrect password').toBe(401);
    const body: ErrorResponse = await response.json();
    expect(body.message).toBe('Invalid email or password');
    expect(Object.hasOwn(body, 'token'), 'Rejected login must not expose a token').toBe(false);
  });
});

test('API-05 | Protected rooms endpoint rejects a request without a token', async ({ scenario }) => {
  await test.step('Request rooms using the unauthenticated request context', async () => {
    const response = await scenario.api.rooms.list();
    expect(response.status(), 'GET /api/rooms without Authorization').toBe(401);

    const text = await response.text();
    if (text.trim() && response.headers()['content-type']?.includes('json')) {
      const body: unknown = JSON.parse(text);
      expect(Array.isArray(body), 'Unauthorized response must not return the room list').toBe(false);
      if (typeof body === 'object' && body !== null) {
        expect(Object.hasOwn(body, 'rooms'), 'Unauthorized response must not expose rooms')
          .toBe(false);
      }
    }
  });
});
