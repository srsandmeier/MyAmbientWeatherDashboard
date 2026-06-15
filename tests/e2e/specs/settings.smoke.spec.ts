/**
 * @p0 Settings page smoke tests.
 *
 * Verifies that the credentials card, preferences card, and devices section render
 * correctly and that credentials can be saved/deleted without leaking secret values.
 * All Auth0 and BFF calls are mocked — no backend required.
 */

import { test, expect, mockStation, buildDevicesBody } from '../fixtures';

test.describe('Settings smoke @p0', () => {
  test('credentials card renders expected elements', async ({ settingsPage, context }) => {
    await context.route('**/api/settings/credentials**', (route) =>
      route.fulfill({ contentType: 'application/json', body: '{"hasCredentials":false}' }),
    );

    await test.step('navigate to settings', () => settingsPage.gotoSettings());
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });

    await test.step('open account menu', () => settingsPage.openAccountMenu());

    await expect(settingsPage.credentialsStatus).toBeVisible();
    await expect(settingsPage.apiKeyInput).toBeVisible();
    await expect(settingsPage.applicationKeyInput).toBeVisible();
    await expect(settingsPage.saveCredentialsButton).toBeVisible();
    await settingsPage.screenshot('smoke-01-credentials-card.png');
  });

  test('preferences card renders all six selects', async ({ settingsPage }) => {
    await test.step('navigate to settings', () => settingsPage.gotoSettings());
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });

    await test.step('expand preferences card', () => settingsPage.preferencesToggle.click());

    const preferenceIds = [
      'settings-preferences-temperature-select',
      'settings-preferences-speed-select',
      'settings-preferences-pressure-select',
      'settings-preferences-rainfall-select',
      'settings-preferences-theme-select',
      'settings-preferences-date-format-select',
      'settings-preferences-save-button',
    ];

    for (const id of preferenceIds) {
      await expect(settingsPage.preferenceControl(id)).toBeVisible({ timeout: 8_000 });
    }
    await settingsPage.screenshot('smoke-02-preferences-card.png');
  });

  test('devices card shows no-credentials prompt', async ({ settingsPage, context }) => {
    await context.route('**/api/settings/credentials**', (route) =>
      route.fulfill({ contentType: 'application/json', body: '{"hasCredentials":false}' }),
    );

    await test.step('navigate to settings', () => settingsPage.gotoSettings());
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
    await expect(settingsPage.noCredentialsDevicesPrompt).toBeVisible();
    await settingsPage.screenshot('smoke-03-devices-card.png');
  });

  test('no React error boundary triggered', async ({ settingsPage, page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await test.step('navigate to settings', () => settingsPage.gotoSettings());
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });

    const errorBoundaryVisible = await settingsPage.isErrorBoundaryVisible();
    expect(errorBoundaryVisible, 'React error boundary must not trigger on Settings').toBe(false);
    expect(jsErrors, `Unhandled JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    await settingsPage.screenshot('smoke-04-no-errors.png');
  });

  test('credentials save shows success and does not render secrets', async ({
    settingsPage,
    context,
    page,
  }) => {
    let credentialsSaved = false;
    let capturedBody: string | null = null;

    await context.route('**/api/settings/credentials**', async (route) => {
      if (route.request().method() === 'POST') {
        capturedBody = route.request().postData();
        credentialsSaved = true;
        await route.fulfill({ status: 204 });
      } else {
        await route.fulfill({
          contentType: 'application/json',
          body: credentialsSaved ? '{"hasCredentials":true}' : '{"hasCredentials":false}',
        });
      }
    });

    await test.step('navigate to settings', () => settingsPage.gotoSettings());
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
    await test.step('open account menu', () => settingsPage.openAccountMenu());
    await expect(settingsPage.apiKeyInput).toBeVisible();

    await test.step('fill and save credentials', async () => {
      await settingsPage.fillCredentials('test-api-key', 'test-app-key');
      await settingsPage.clickSaveCredentials();
    });

    await expect(settingsPage.credentialsStatus).toContainText('Saved', { timeout: 10_000 });

    await expect.poll(() => capturedBody, { timeout: 10_000 }).not.toBeNull();
    expect(capturedBody).toContain('test-api-key');
    expect(capturedBody).toContain('test-app-key');

    const pageContent = await page.content();
    expect(pageContent, 'API key must not be rendered back to the browser').not.toContain('test-api-key');
    expect(pageContent, 'App key must not be rendered back to the browser').not.toContain('test-app-key');
    await settingsPage.screenshot('smoke-06-credentials-save-success.png');
  });

  test('delete credentials can be cancelled, then confirmed', async ({
    settingsPage,
    context,
  }) => {
    let hasCredentials = true;
    let deleteCalls = 0;

    await context.route('**/api/settings/credentials**', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalls += 1;
        hasCredentials = false;
        await route.fulfill({ status: 204 });
        return;
      }

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ hasCredentials }),
      });
    });

    await test.step('navigate to settings', () => settingsPage.gotoSettings());
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
    await test.step('open account menu', () => settingsPage.openAccountMenu());

    await expect(settingsPage.deleteCredentialsButton).toBeVisible();
    await test.step('open delete confirmation', () => settingsPage.clickDeleteCredentials());
    await expect(settingsPage.deleteConfirmation).toBeVisible();

    await test.step('cancel delete', () => settingsPage.clickCancelDelete());
    await expect(settingsPage.deleteConfirmation).toBeHidden();
    await expect.poll(() => deleteCalls, { timeout: 5_000 }).toBe(0);

    await test.step('confirm delete', async () => {
      await settingsPage.clickDeleteCredentials();
      await expect(settingsPage.deleteConfirmation).toBeVisible();
      await settingsPage.clickConfirmDelete();
    });

    await expect.poll(() => deleteCalls, { timeout: 10_000 }).toBe(1);
    await expect(settingsPage.credentialsStatus).toContainText('Not configured', { timeout: 10_000 });
    await settingsPage.screenshot('smoke-05-delete-confirm.png');
  });

  test('runtime mock station renders with test.1 nickname', async ({ settingsPage, context }) => {
    await context.route('**/api/settings/devices**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: buildDevicesBody(mockStation, 'test.1'),
      }),
    );

    await test.step('navigate to settings', () => settingsPage.gotoSettings());
    await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
    await expect(settingsPage.runtimeMockStationRow).toBeVisible({ timeout: 10_000 });
    await settingsPage.screenshot('smoke-07-runtime-mock-station.png');
  });
});
