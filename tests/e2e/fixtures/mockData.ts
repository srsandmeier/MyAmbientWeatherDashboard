import { faker } from '@faker-js/faker';

export interface MockStation {
  readonly macAddress: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly elevationMeters: number;
  readonly address: string;
  readonly location: string;
}

/** Single mock station fixture — regenerated per test process run. */
export const mockStation: MockStation = {
  macAddress: faker.string.hexadecimal({ length: 12, casing: 'upper', prefix: '' }),
  latitude: faker.location.latitude({ min: 25, max: 49 }),
  longitude: faker.location.longitude({ min: -124, max: -66 }),
  elevationMeters: faker.number.int({ min: 10, max: 2000 }),
  address: `${faker.location.buildingNumber()} ${faker.location.street()}, ${faker.location.city()}, ${faker.location.state({ abbreviated: true })} ${faker.location.zipCode()}`,
  location: faker.location.city(),
};
