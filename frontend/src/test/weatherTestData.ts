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

/** Real US airports; a fixture that needs a station code or a place name uses one picked at random. */
const airports = [
  { icao: 'KATL', iata: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', state: 'GA' },
  { icao: 'KBOS', iata: 'BOS', name: 'Boston Logan International Airport', city: 'Boston', state: 'MA' },
  { icao: 'KDEN', iata: 'DEN', name: 'Denver International Airport', city: 'Denver', state: 'CO' },
  { icao: 'KDFW', iata: 'DFW', name: 'Dallas Fort Worth International Airport', city: 'Dallas', state: 'TX' },
  { icao: 'KLAX', iata: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', state: 'CA' },
  { icao: 'KMIA', iata: 'MIA', name: 'Miami International Airport', city: 'Miami', state: 'FL' },
  { icao: 'KMSP', iata: 'MSP', name: 'Minneapolis-Saint Paul International Airport', city: 'Minneapolis', state: 'MN' },
  { icao: 'KORD', iata: 'ORD', name: 'Chicago OHare International Airport', city: 'Chicago', state: 'IL' },
  { icao: 'KPHX', iata: 'PHX', name: 'Phoenix Sky Harbor International Airport', city: 'Phoenix', state: 'AZ' },
  { icao: 'KSEA', iata: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', state: 'WA' },
] as const;

export const testAirport = faker.helpers.arrayElement(airports);
export const testAirportCityState = `${testAirport.city}, ${testAirport.state}`;

export function metricTileId(prefix: string, deviceId = testDeviceId) {
  return `${prefix}-${deviceId}`;
}
