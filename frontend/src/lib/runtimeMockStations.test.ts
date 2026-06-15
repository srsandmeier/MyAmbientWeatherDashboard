import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import type { SettingsDeviceDto } from '../types/settings';
import { withRuntimeMockStations } from './runtimeMockStations';

function buildRealDevice(nickname: string): SettingsDeviceDto {
  return {
    macAddress: faker.string.hexadecimal({ length: 12, prefix: '' }),
    name: faker.company.name(),
    nickname,
    isPrimary: false,
    displayOnDashboard: true,
    selectedMetricKeys: null,
    latitude: faker.location.latitude(),
    longitude: faker.location.longitude(),
    elevationMeters: null,
    address: null,
    location: faker.location.city(),
    lastSyncAtUtc: null,
  };
}

describe('withRuntimeMockStations', () => {
  it('injects mock stations whose metric keys exclude Open-Meteo extended metrics', () => {
    const devices = withRuntimeMockStations([buildRealDevice('test.1')]);
    const mock = devices.find((device) => device.isMock);

    expect(mock).toBeDefined();
    const omKeys = (mock?.selectedMetricKeys ?? []).filter((key) => key.startsWith('om_'));
    expect(omKeys).toEqual([]);
    expect(mock?.selectedMetricKeys).toContain('outdoor_temp');
  });
});
