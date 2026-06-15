import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { queryKeys } from '../lib/queryKeys';
import type { CurrentReadingDto, DashboardRainfallDto, ReadingUpdatedEventDto } from '../types/dashboard';

/** Connection state exposed to consumers. */
export type WeatherHubState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface UseWeatherHubResult {
  /** Current SignalR connection state. */
  readonly hubState: WeatherHubState;
}

const MAX_RETRY_DELAY_MS = 30_000;
const HUB_URL = '/hubs/weather';

/**
 * Connects to the SignalR /hubs/weather endpoint and updates the TanStack Query
 * dashboard.current cache on every ReadingUpdated push.
 *
 * Reconnects with bounded exponential back-off (max 30 s). Stops and cleans up
 * all handlers on unmount.
 */
export function useWeatherHub(): UseWeatherHubResult {
  const { getAccessToken, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const connectionRef = useRef<HubConnection | null>(null);
  const [hubState, setHubState] = useState<WeatherHubState>('disconnected');

  useEffect(() => {
    if (!isAuthenticated) return;

    let retryCount = 0;
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function nextDelay() {
      const delay = Math.min(1_000 * 2 ** retryCount, MAX_RETRY_DELAY_MS);
      retryCount += 1;
      return delay;
    }

    function buildConnection(): HubConnection {
      return new HubConnectionBuilder()
        .withUrl(HUB_URL, {
          accessTokenFactory: () => getAccessToken(),
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: () => nextDelay(),
        })
        // LogLevel.None suppresses the expected "stopped during negotiation" noise
        // that SignalR logs internally before our catch block can intercept it.
        .configureLogging(LogLevel.None)
        .build();
    }

    function scheduleStart() {
      if (stopped) return;
      retryTimer = setTimeout(() => {
        void start();
      }, nextDelay());
    }

    async function start() {
      if (stopped) return;

      const connection = buildConnection();
      connectionRef.current = connection;

      // Invalidate device list at most once per minute when readings arrive so
      // the settings page picks up newly connected stations without per-reading fetches.
      let lastDevicesInvalidation = 0;
      function maybeInvalidateDevices() {
        const now = Date.now();
        if (now - lastDevicesInvalidation >= 60_000) {
          lastDevicesInvalidation = now;
          void queryClient.invalidateQueries({ queryKey: queryKeys.settings.devices() });
        }
      }

      connection.on('ReadingUpdated', (dto: ReadingUpdatedEventDto) => {
        const { reading } = dto;
        queryClient.setQueryData<CurrentReadingDto>(queryKeys.dashboard.current(), reading);
        queryClient.setQueryData<DashboardRainfallDto>(queryKeys.dashboard.rainfall(), {
          deviceId: reading.deviceId,
          deviceName: reading.deviceName,
          timestampUtc: reading.timestampUtc,
          receivedAtUtc: reading.receivedAtUtc,
          eventRainIn: reading.eventRainIn,
          dailyRainIn: reading.dailyRainIn,
          weeklyRainIn: reading.weeklyRainIn,
          monthlyRainIn: reading.monthlyRainIn,
          yearlyRainIn: reading.yearlyRainIn,
          lastRain: reading.lastRain,
        });
        maybeInvalidateDevices();
      });

      connection.onreconnecting(() => {
        setHubState('reconnecting');
      });

      connection.onreconnected(() => {
        retryCount = 0;
        setHubState('connected');
        maybeInvalidateDevices();
      });

      connection.onclose(() => {
        setHubState('disconnected');
        scheduleStart();
      });

      let connectSucceeded = false;
      try {
        setHubState('connecting');
        await connection.start();
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (stopped) {
          // Cleanup ran while we were awaiting — tear down and exit.
          void connection.stop().catch(() => undefined);
          return;
        }
        retryCount = 0;
        setHubState('connected');
        connectSucceeded = true;
      } catch {
        // If the component unmounted during negotiation the stop() call in the
        // cleanup rejects connection.start() with "stopped during negotiation".
        // That is expected in React StrictMode and in production teardowns —
        // ignore it and do not schedule a retry.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (stopped) return;
        setHubState('disconnected');
        scheduleStart();
      }
      if (connectSucceeded) {
        lastDevicesInvalidation = Date.now();
        maybeInvalidateDevices();
      }
    }

    function teardown() {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      const conn = connectionRef.current;
      connectionRef.current = null;
      if (conn) {
        conn.off('ReadingUpdated');
        // Neutralise onclose before stopping: conn.stop() is async and its
        // settlement fires onclose. Without this, a bfcache restore that resets
        // stopped=false before the old onclose fires would cause scheduleStart()
        // to pass its guard and open a second concurrent connection.
        conn.onclose(() => undefined);
        conn.stop().catch(() => undefined);
      }
    }

    // Close the WebSocket when the page enters bfcache — an open WebSocket blocks
    // bfcache entirely. On restore, reopen the connection from scratch.
    function handlePageHide(e: PageTransitionEvent) {
      if (!e.persisted) return;
      teardown();
      setHubState('disconnected');
    }

    function handlePageShow(e: PageTransitionEvent) {
      if (!e.persisted) return;
      stopped = false;
      retryCount = 0;
      void start();
    }

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    void start();

    return () => {
      teardown();
      setHubState('disconnected');
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [isAuthenticated, getAccessToken, queryClient]);

  return { hubState };
}
