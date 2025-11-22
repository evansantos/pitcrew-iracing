import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProcessedTelemetry, StrategyRecommendation } from '@iracing-race-engineer/shared';

interface Racer {
  name: string;
  mock: boolean;
}

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

  // Multi-racer support
  availableRacers: Racer[];
  selectedRacer: string | null;

  // Actions
  updateTelemetry: (racerName: string, data: ProcessedTelemetry) => void;
  updateStrategy: (strategy: StrategyRecommendation) => void;
  setConnected: (connected: boolean) => void;
  setLive: (isLive: boolean) => void;
  setRelayConnected: (relayConnected: boolean) => void;
  setAvailableRacers: (racers: Racer[]) => void;
  setSelectedRacer: (racerName: string | null) => void;
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
  availableRacers: [],
  selectedRacer: null,

  // Actions
  updateTelemetry: (racerName, data) =>
    set((state) => {
      // Auto-select first racer if none selected
      if (state.selectedRacer === null) {
        console.log(`[TelemetryStore] Auto-selecting first racer: ${racerName}`);
        return {
          data,
          isLive: true,
          lastUpdateTime: Date.now(),
          selectedRacer: racerName,
        };
      }

      // Only update if this racer is currently selected
      if (state.selectedRacer === racerName) {
        return {
          data,
          isLive: true,
          lastUpdateTime: Date.now(),
        };
      }

      // Different racer's data - ignore it
      return {};
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

  setAvailableRacers: (racers) => set({ availableRacers: racers }),

  setSelectedRacer: (racerName) => set({ selectedRacer: racerName }),

  reset: () =>
    set({
      data: null,
      strategy: null,
      connected: false,
      isLive: false,
      relayConnected: false,
      lastUpdateTime: null,
      availableRacers: [],
      selectedRacer: null,
    }),
}));
