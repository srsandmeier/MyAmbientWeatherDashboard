import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWeatherHub } from './useWeatherHub';
import { testDeviceId, testDeviceName } from '../test/weatherTestData';
import type { CurrentReadingDto, ReadingUpdatedEventDto } from '../types/dashboard';

// ── SignalR mock ──────────────────────────────────────────────────────────────

type Handler = (...args: unknown[]) => void;

interface MockConnection {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  onclose: ReturnType<typeof vi.fn>;
  onreconnecting: ReturnType<typeof vi.fn>;
  onreconnected: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  state: string;
  _handlers: Record<string, Handler[]>;
  _emit: (event: string, ...args: unknown[]) => void;
}

let mockConnection: MockConnection;
const signalRMockState = vi.hoisted(() => ({
  connections: [] as MockConnection[],
  startResults: [] as (() => Promise<void>)[],
}));

vi.mock('@microsoft/signalr', () => {
  const HubConnectionState = {
    Connected: 'Connected',
    Connecting: 'Connecting',
    Reconnecting: 'Reconnecting',
    Disconnected: 'Disconnected',
    Disconnecting: 'Disconnecting',
  };
  const LogLevel = { Warning: 1 };

  const createMock = (): MockConnection => {
    const handlers: Record<string, Handler[]> = {};
    const conn: MockConnection = {
      on: vi.fn((event: string, handler: Handler) => {
        handlers[event] = [...(handlers[event] ?? []), handler];
      }),
      off: vi.fn((event: string) => {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete handlers[event];
      }),
      onclose: vi.fn(),
      onreconnecting: vi.fn(),
      onreconnected: vi.fn(),
      start: vi.fn(() => signalRMockState.startResults.shift()?.() ?? Promise.resolve()),
      stop: vi.fn().mockResolvedValue(undefined),
      state: HubConnectionState.Disconnected,
      _handlers: handlers,
      _emit(event: string, ...args: unknown[]) {
        (handlers[event] ?? []).forEach((h) => { h(...args); });
      },
    };
    return conn;
  };

  class MockHubConnectionBuilder {
    withUrl() { return this; }
    withAutomaticReconnect() { return this; }
    configureLogging() { return this; }
    build() {
      mockConnection = createMock();
      signalRMockState.connections.push(mockConnection);
      return mockConnection;
    }
  }

  return { HubConnectionBuilder: MockHubConnectionBuilder, HubConnectionState, LogLevel };
});

// ── Auth mock ─────────────────────────────────────────────────────────────────

const mockGetAccessToken = vi.fn().mockResolvedValue('test-token');
const mockIsAuthenticated = { value: true };

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated.value,
    getAccessToken: mockGetAccessToken,
  }),
}));

// ── QueryClient mock ──────────────────────────────────────────────────────────

const mockSetQueryData = vi.fn();
const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
const mockQueryClient = { setQueryData: mockSetQueryData, invalidateQueries: mockInvalidateQueries };
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
}));

// ─────────────────────────────────────────────────────────────────────────────

describe('useWeatherHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockIsAuthenticated.value = true;
    signalRMockState.connections = [];
    signalRMockState.startResults = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not connect when unauthenticated', () => {
    mockIsAuthenticated.value = false;
    renderHook(() => useWeatherHub());
    expect(mockGetAccessToken).not.toHaveBeenCalled();
  });

  it('should return connecting state while starting', async () => {
    let resolveStart!: () => void;
    const startPromise = new Promise<void>((res) => { resolveStart = res; });

    mockConnection = undefined as unknown as MockConnection;
    const { result } = renderHook(() => useWeatherHub());

    await waitFor(() => { expect(mockConnection).toBeDefined(); });
    mockConnection.start.mockReturnValue(startPromise);

    resolveStart();
    await waitFor(() => result.current.hubState === 'connected');
  });

  it('should reach connected state after start resolves', async () => {
    const { result } = renderHook(() => useWeatherHub());
    await waitFor(() => { expect(result.current.hubState).toBe('connected'); });
  });

  it('should update query cache on ReadingUpdated event', async () => {
    const { result } = renderHook(() => useWeatherHub());

    await waitFor(() => result.current.hubState === 'connected');

    const reading: CurrentReadingDto = {
      deviceId: testDeviceId,
      deviceName: testDeviceName,
      timestampUtc: '2026-05-31T12:00:00Z',
      receivedAtUtc: '2026-05-31T12:00:01Z',
      tempF: 72.4,
      battOut: null,
      tempInF: null, feelsLike: null, feelsLikeIn: null, dewPoint: null, dewPointIn: null,
      humidity: 62, humidityIn: null,
      baromRelIn: null, baromAbsIn: null,
      windDir: null, windSpeedMph: null, windGustMph: null, maxDailyGust: null,
      solarRadiation: null, uv: null,
      hourlyRainIn: null, eventRainIn: null, dailyRainIn: null, weeklyRainIn: null,
      monthlyRainIn: null, yearlyRainIn: null, totalRainIn: null, lastRain: null,
      dailyHighTempF: null, dailyLowTempF: null,
      nwsSkyConditions: null, nwsPresentWeather: null, nwsTextDescription: null, nwsRawMetar: null,
      omCloudCover: null, omPrecipProbability: null, omWeatherDescription: null,
      omSunrise: null, omSunset: null, omUvIndexMax: null, omPrecipSumIn: null,
      omWindSpeedMax: null, omWindGustMax: null, omWindDirDominant: null,
      tz: null,
    };

    const dto: ReadingUpdatedEventDto = { reading };

    act(() => {
      mockConnection._emit('ReadingUpdated', dto);
    });

    expect(mockSetQueryData).toHaveBeenCalledWith(
      ['dashboard', 'current'],
      reading,
    );
    // Rainfall cache also receives extracted fields from the same push.
    expect(mockSetQueryData).toHaveBeenCalledWith(
      ['dashboard', 'rainfall'],
      expect.objectContaining({ deviceId: reading.deviceId }),
    );
  });

  it('should call start on the hub connection', async () => {
    const { result } = renderHook(() => useWeatherHub());

    await waitFor(() => result.current.hubState === 'connected');

    expect(mockConnection.start).toHaveBeenCalledOnce();
  });

  it('should remove ReadingUpdated handler on unmount', async () => {
    const { result, unmount } = renderHook(() => useWeatherHub());

    await waitFor(() => result.current.hubState === 'connected');
    unmount();

    expect(mockConnection.off).toHaveBeenCalledWith('ReadingUpdated');
    expect(mockConnection.stop).toHaveBeenCalled();
  });

  it('should stop the connection on unmount', async () => {
    const { result, unmount } = renderHook(() => useWeatherHub());

    await waitFor(() => result.current.hubState === 'connected');
    unmount();

    expect(mockConnection.stop).toHaveBeenCalled();
  });

  it('should register onreconnecting and onreconnected callbacks on connect', async () => {
    const { result } = renderHook(() => useWeatherHub());

    await waitFor(() => result.current.hubState === 'connected');

    expect(mockConnection.onreconnecting).toHaveBeenCalledOnce();
    expect(mockConnection.onreconnected).toHaveBeenCalledOnce();
  });

  it('should transition connected → reconnecting → connected when hub reconnects', async () => {
    const { result } = renderHook(() => useWeatherHub());

    await waitFor(() => { expect(result.current.hubState).toBe('connected'); });

    const onReconnecting = mockConnection.onreconnecting.mock.calls[0][0] as () => void;
    const onReconnected = mockConnection.onreconnected.mock.calls[0][0] as () => void;

    act(() => { onReconnecting(); });
    expect(result.current.hubState).toBe('reconnecting');

    act(() => { onReconnected(); });
    expect(result.current.hubState).toBe('connected');
  });

  it('should reschedule start after onclose fires', async () => {
    const { result } = renderHook(() => useWeatherHub());

    await waitFor(() => { expect(result.current.hubState).toBe('connected'); });

    // Capture the onclose callback registered on the first connection.
    const firstConn = mockConnection;
    expect(firstConn.onclose).toHaveBeenCalledOnce();
    const oncloseCallback = firstConn.onclose.mock.calls[0][0] as () => void;

    // Simulate SignalR firing onclose (e.g. after exhausting automatic reconnect retries).
    act(() => { oncloseCallback(); });

    expect(result.current.hubState).toBe('disconnected');

    // scheduleStart() fires after a backoff delay (~1 s for the first retry).
    // A second connection must be built within that window.
    await waitFor(
      () => { expect(signalRMockState.connections).toHaveLength(2); },
      { timeout: 2_000 },
    );
  });

  it('should retry an initial start failure', async () => {
    signalRMockState.startResults.push(
      () => Promise.reject(new Error('negotiate failed')),
      () => Promise.resolve(),
    );

    const { result } = renderHook(() => useWeatherHub());

    await waitFor(() => {
      expect(signalRMockState.connections).toHaveLength(1);
      expect(result.current.hubState).toBe('disconnected');
    });

    await waitFor(
      () => {
        expect(signalRMockState.connections).toHaveLength(2);
        expect(result.current.hubState).toBe('connected');
      },
      { timeout: 1_500 },
    );
  });
});
