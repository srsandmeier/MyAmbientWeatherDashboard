/**
 * @p1 Owned device settings tests.
 *
 * Verifies that Settings -> My Stations can sync owned devices, autosave dashboard/primary
 * flags, and explicitly save nickname + metric selections.
 * All Auth0 and BFF calls are mocked — no backend required.
 */

import { test, expect, mockStation } from '../fixtures';

interface Device {
  readonly macAddress: string;
  readonly name: string | null;
  readonly nickname: string | null;
  readonly isPrimary: boolean;
  readonly displayOnDashboard: boolean;
  readonly selectedMetricKeys: readonly string[] | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly elevationMeters: number | null;
  readonly address: string | null;
  readonly location: string | null;
  readonly lastSyncAtUtc: string | null;
}

type DevicePatch = {
  readonly nickname?: string | null;
  readonly isPrimary?: boolean;
  readonly displayOnDashboard?: boolean;
  readonly selectedMetricKeys?: readonly string[] | null;
};

function normalizeMac(mac: string): string {
  return mac.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function buildDevice(overrides: Partial<Device> & Pick<Device, 'macAddress'>): Device {
  return {
    macAddress: overrides.macAddress,
    name: overrides.name ?? 'Owned Station',
    nickname: overrides.nickname ?? null,
    isPrimary: overrides.isPrimary ?? false,
    displayOnDashboard: overrides.displayOnDashboard ?? true,
    selectedMetricKeys: overrides.selectedMetricKeys ?? ['outdoor_temp', 'wind_speed'],
    latitude: overrides.latitude ?? mockStation.latitude,
    longitude: overrides.longitude ?? mockStation.longitude,
    elevationMeters: overrides.elevationMeters ?? mockStation.elevationMeters,
    address: overrides.address ?? mockStation.address,
    location: overrides.location ?? mockStation.location,
    lastSyncAtUtc: overrides.lastSyncAtUtc ?? '2026-06-01T00:00:00Z',
  };
}

function applyPatch(devices: readonly Device[], mac: string, patch: DevicePatch): readonly Device[] {
  return devices.map((device) => {
    if (device.macAddress !== mac) {
      return patch.isPrimary === true ? { ...device, isPrimary: false } : device;
    }

    return {
      ...device,
      ...patch,
      selectedMetricKeys: patch.selectedMetricKeys ?? device.selectedMetricKeys,
    };
  });
}

test.describe('Owned device settings @p1', () => {
  test('syncs devices and saves dashboard visibility, primary station, nickname, and metrics', async ({
    settingsPage,
    context,
  }) => {
    const secondaryMac = 'A1B2C3D4E5F6';
    const primaryRowId = normalizeMac(mockStation.macAddress);
    const secondaryRowId = normalizeMac(secondaryMac);

    const syncedDevices = [
      buildDevice({
        macAddress: mockStation.macAddress,
        name: 'Primary Owned Station',
        nickname: 'Roof station',
        isPrimary: true,
      }),
      buildDevice({
        macAddress: secondaryMac,
        name: 'Backyard Owned Station',
        nickname: null,
        isPrimary: false,
        selectedMetricKeys: ['outdoor_temp'],
      }),
    ] satisfies readonly Device[];

    let devices: readonly Device[] = [syncedDevices[0]];
    let syncCalls = 0;
    const capturedPatches: DevicePatch[] = [];

    await context.route('**/api/settings/devices', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(devices) });
    });

    await context.route('**/api/settings/devices/*', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }

      const mac = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1) ?? '');
      const patch = JSON.parse(route.request().postData() ?? '{}') as DevicePatch;
      capturedPatches.push(patch);
      devices = applyPatch(devices, mac, patch);
      await route.fulfill({ status: 204 });
    });

    await context.route('**/api/settings/devices/sync', async (route) => {
      syncCalls += 1;
      devices = syncedDevices;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(devices) });
    });

    await test.step('sync owned devices', async () => {
      await settingsPage.gotoSettings();
      await expect(settingsPage.root).toBeVisible({ timeout: 30_000 });
      await expect(settingsPage.deviceTitle(primaryRowId)).toContainText('Roof station');

      await settingsPage.devicesSyncButton.click();
      await expect.poll(() => syncCalls, { timeout: 10_000 }).toBe(1);
      await expect(settingsPage.deviceTitle(secondaryRowId)).toContainText('Backyard Owned Station', {
        timeout: 10_000,
      });
    });

    await test.step('autosave primary and dashboard visibility flags', async () => {
      await settingsPage.devicePrimaryRadio(secondaryRowId).click();
      await expect.poll(() => capturedPatches.at(-1), { timeout: 10_000 }).toMatchObject({
        isPrimary: true,
      });

      const visibilityToggle = settingsPage.deviceVisibilityToggle(primaryRowId);
      await visibilityToggle.click();
      await expect(visibilityToggle).not.toBeChecked({ timeout: 10_000 });
      await expect.poll(() => capturedPatches.at(-1), { timeout: 10_000 }).toMatchObject({
        displayOnDashboard: false,
      });
      await expect(settingsPage.deviceAutosaveStatus(primaryRowId)).toContainText('Saved.');
    });

    await test.step('save nickname and metric selection', async () => {
      await expect(settingsPage.deviceNicknameInput(secondaryRowId)).toBeVisible({ timeout: 10_000 });

      await settingsPage.deviceNicknameInput(secondaryRowId).fill('Garden station');
      await settingsPage.deviceMetric(secondaryRowId, 'uv_index').check();
      await settingsPage.deviceSaveButton(secondaryRowId).click();
    });

    await expect.poll(() => capturedPatches.at(-1), { timeout: 10_000 }).toMatchObject({
      nickname: 'Garden station',
      selectedMetricKeys: expect.arrayContaining(['outdoor_temp', 'uv_index']),
    });
  });
});
