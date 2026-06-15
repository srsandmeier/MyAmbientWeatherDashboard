import { faker } from '@faker-js/faker';

export const testDeviceId = faker.string.hexadecimal({ length: 12, casing: 'upper', prefix: '' });
export const testDeviceIdColon = testDeviceId.match(/.{1,2}/g)?.join(':') ?? testDeviceId;
export const testDeviceRowId = testDeviceId.toLowerCase();
export const testDeviceName = `Generated station ${faker.string.alphanumeric(4)}`;
export const testDeviceNickname = `Generated nickname ${faker.string.alphanumeric(4)}`;
export const testDeviceTz = 'UTC';

export const testOtherDeviceId = faker.string.hexadecimal({ length: 12, casing: 'upper', prefix: '' });
export const testOtherDeviceIdColon = testOtherDeviceId.match(/.{1,2}/g)?.join(':') ?? testOtherDeviceId;
export const testOtherDeviceRowId = testOtherDeviceId.toLowerCase();
export const testOtherDeviceName = `Generated station ${faker.string.alphanumeric(4)}`;

export function metricTileId(prefix: string, deviceId = testDeviceId) {
  return `${prefix}-${deviceId}`;
}
