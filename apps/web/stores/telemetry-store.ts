import { create } from 'zustand';
import type { ProcessedTelemetry, StrategyRecommendation } from '@iracing-race-engineer/shared';

interface TelemetryState {
  // Current telemetry data
  data: ProcessedTelemetry | null;

  // Strategy data from backend
  strategy: StrategyRecommendation | null;

  // Connection status
  connected: boolean;
  isLive: boolean;
  relayConnected: boolean; // Track if relay is connected to backend

  // Last update timestamp
  lastUpdateTime: number | null;

  // Actions
  updateTelemetry: (data: ProcessedTelemetry) => void;
  updateStrategy: (strategy: StrategyRecommendation) => void;
  setConnected: (connected: boolean) => void;
  setLive: (isLive: boolean) => void;
  setRelayConnected: (relayConnected: boolean) => void;
  reset: () => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  // Initial state
  data: null,
  strategy: null,
  connected: false,
  isLive: false,
  relayConnected: false,
  lastUpdateTime: null,

  // Actions
  updateTelemetry: (data) =>
    set({
      data,
      isLive: true,
      lastUpdateTime: Date.now(),
    }),

  updateStrategy: (strategy) =>
    set({
      strategy,
    }),

  setConnected: (connected) =>
    set({
      connected,
      isLive: connected ? undefined : false,
    }),

  setLive: (isLive) => set({ isLive }),

  setRelayConnected: (relayConnected) => set({ relayConnected }),

  reset: () =>
    set({
      data: null,
      strategy: null,
      connected: false,
      isLive: false,
      relayConnected: false,
      lastUpdateTime: null,
    }),
}));
