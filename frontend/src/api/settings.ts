import { apiFetch, type ApiResult } from './client';
import type {
  AmbientCredentialStatusDto,
  SaveCredentialsRequest,
  SettingsDeviceDto,
  UpdateDeviceSettingsRequest,
  UpdatePreferencesRequest,
  UserPreferencesDto,
} from '../types/settings';

export async function getCredentialStatus(token: string): Promise<ApiResult<AmbientCredentialStatusDto>> {
  return apiFetch<AmbientCredentialStatusDto>('/api/settings/credentials', { token });
}

export async function saveCredentials(
  body: SaveCredentialsRequest,
  token: string,
): Promise<ApiResult<undefined>> {
  return apiFetch<undefined>('/api/settings/credentials', { method: 'POST', body, token });
}

export async function deleteCredentials(token: string): Promise<ApiResult<undefined>> {
  return apiFetch<undefined>('/api/settings/credentials', { method: 'DELETE', token });
}

export async function getPreferences(token: string): Promise<ApiResult<UserPreferencesDto>> {
  return apiFetch<UserPreferencesDto>('/api/settings/preferences', { token });
}

export async function updatePreferences(
  body: UpdatePreferencesRequest,
  token: string,
): Promise<ApiResult<UserPreferencesDto>> {
  return apiFetch<UserPreferencesDto>('/api/settings/preferences', { method: 'PUT', body, token });
}

export async function getDevices(token: string): Promise<ApiResult<SettingsDeviceDto[]>> {
  return apiFetch<SettingsDeviceDto[]>('/api/settings/devices', { token });
}

export async function syncDevices(token: string): Promise<ApiResult<SettingsDeviceDto[]>> {
  return apiFetch<SettingsDeviceDto[]>('/api/settings/devices/sync', { method: 'POST', token });
}

export async function updateDevice(
  mac: string,
  body: UpdateDeviceSettingsRequest,
  token: string,
): Promise<ApiResult<undefined>> {
  return apiFetch<undefined>(`/api/settings/devices/${encodeURIComponent(mac)}`, {
    method: 'PUT',
    body,
    token,
  });
}
