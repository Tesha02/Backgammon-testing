import { test, expect } from '..\\..\\fixtures\\browser';
import { newUserData } from '..\\..\\helpers\\test-data';

test('UI-01 | Registration requires every field', async ({ actors }) => {
  const visitor = await actors.guest('Visitor');

  await test.step('Submit an empty registration form', async () => {
    await visitor.register.open();
    await visitor.register.submit();
  });

  await test.step('Show the required-fields error without leaving registration', async () => {
    await expect(visitor.register.error).toHaveText('All fields are required.');
    await expect(visitor.page).toHaveURL(/\/register$/);
    await expect(visitor.register.form).toBeVisible();
    await expect(visitor.register.submitButton).toBeEnabled();
  });
});

test('UI-02 | Registration rejects mismatched passwords', async ({ actors }) => {
  const visitor = await actors.guest('Visitor');
  const data = newUserData();

  await test.step('Submit valid identity fields with different passwords', async () => {
    await visitor.register.open();
    await visitor.register.fill(data, `${data.password}Different`);
    await visitor.register.submit();
  });

  await test.step('Keep the registration form and show the password mismatch', async () => {
    await expect(visitor.register.error).toHaveText('Passwords do not match.');
    await expect(visitor.page).toHaveURL(/\/register$/);
    await expect(visitor.register.form).toBeVisible();
    await expect(visitor.login.registrationNotice).toHaveCount(0);
    await expect(visitor.register.submitButton).toBeEnabled();
  });
});

test('UI-03 | An incorrect login password shows the server error',
  async ({ actors, scenario }) => {
    const user = await test.step('Prepare a registered account through the API',
      () => scenario.registerUser());
    const visitor = await actors.guest('Visitor');

    await test.step('Submit an incorrect password to the real login endpoint', async () => {
      await visitor.login.open();
      const response = await visitor.login.login({
        email: user.data.email,
        password: `${user.data.password}Incorrect`,
      });
      expect(response.status(), 'POST /auth/login with an incorrect password').toBe(401);
    });

    await test.step('Show the error and allow another attempt without entering the lobby',
      async () => {
        await expect(visitor.login.error).toHaveText('Invalid email or password');
        await expect(visitor.page).toHaveURL(/\/login$/);
        await expect(visitor.login.form).toBeVisible();
        await expect(visitor.login.submitButton).toBeEnabled();
        await expect(visitor.lobby.heading).toHaveCount(0);
      });
  });

test('UI-04 | An unauthenticated visitor cannot open the lobby directly', async ({ actors }) => {
  const visitor = await actors.guest('Visitor');

  await test.step('Navigate directly to the protected lobby with a clean session',
    () => visitor.lobby.open());

  await test.step('Redirect to the login form without showing protected content', async () => {
    await expect(visitor.page).toHaveURL(/\/login$/);
    await expect(visitor.login.form).toBeVisible();
    await expect(visitor.login.submitButton).toBeEnabled();
    await expect(visitor.lobby.heading).toHaveCount(0);
    await expect(visitor.lobby.createButton).toHaveCount(0);
  });
});

test('UI-05 | Logout prevents subsequent access to the protected lobby',
  async ({ actors, scenario }) => {
    const user = await test.step('Prepare an authenticated account', () => scenario.createUser());
    const player = await actors.authenticated('Player', user);

    await test.step('Open the lobby as the intended user and log out', async () => {
      await player.lobby.open();
      await expect(player.lobby.username).toHaveText(user.data.username);
      await player.lobby.logout();
      await expect(player.page).toHaveURL(/\/login$/);
      await expect(player.login.form).toBeVisible();
    });

    await test.step('Reject another direct lobby navigation without a new login', async () => {
      await player.lobby.open();
      await expect(player.page).toHaveURL(/\/login$/);
      await expect(player.login.form).toBeVisible();
      await expect(player.lobby.heading).toHaveCount(0);
      await expect(player.lobby.createButton).toHaveCount(0);
    });
  });
