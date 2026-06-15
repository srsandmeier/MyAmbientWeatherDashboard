import { describe, expect, it } from 'vitest';
import { queryKeys } from './queryKeys';

describe('queryKeys', () => {
  it('health key is stable', () => {
    expect(queryKeys.health()).toEqual(queryKeys.health());
  });

  it('settings.preferences key is stable', () => {
    expect(queryKeys.settings.preferences()).toEqual(queryKeys.settings.preferences());
  });

  it('settings.credentialsStatus key is stable', () => {
    expect(queryKeys.settings.credentialsStatus()).toEqual(queryKeys.settings.credentialsStatus());
  });

  it('dashboard.current key is stable', () => {
    expect(queryKeys.dashboard.current()).toEqual(queryKeys.dashboard.current());
  });

  it('dashboard.rainfall key is stable', () => {
    expect(queryKeys.dashboard.rainfall()).toEqual(queryKeys.dashboard.rainfall());
  });

  it('dashboard.layout key is stable', () => {
    expect(queryKeys.dashboard.layout()).toEqual(queryKeys.dashboard.layout());
  });

  it('keys are distinct', () => {
    const health = JSON.stringify(queryKeys.health());
    const prefs = JSON.stringify(queryKeys.settings.preferences());
    const creds = JSON.stringify(queryKeys.settings.credentialsStatus());
    const current = JSON.stringify(queryKeys.dashboard.current());
    const rainfall = JSON.stringify(queryKeys.dashboard.rainfall());
    const layout = JSON.stringify(queryKeys.dashboard.layout());
    const all = [health, prefs, creds, current, rainfall, layout];
    expect(new Set(all).size).toBe(all.length);
  });
});
