'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTelemetryStore } from '@/stores/telemetry-store';
import type { ProcessedTelemetry, StrategyRecommendation } from '@iracing-race-engineer/shared';

interface UseWebSocketReturn {
  connected: boolean;
  socket: Socket | null;
}

export function useWebSocket(): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  const updateTelemetry = useTelemetryStore((state) => state.updateTelemetry);
  const updateStrategy = useTelemetryStore((state) => state.updateStrategy);
  const setStoreConnected = useTelemetryStore((state) => state.setConnected);
  const setRelayConnected = useTelemetryStore((state) => state.setRelayConnected);
  const setAvailableRacers = useTelemetryStore((state) => state.setAvailableRacers);
  const setLive = useTelemetryStore((state) => state.setLive);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';
    const newSocket = io(wsUrl, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected to API server');
      setConnected(true);
      setStoreConnected(true);

      // Identify as webapp client
      newSocket.emit('identify', { type: 'webapp' });

      // Subscribe to telemetry and strategy
      newSocket.emit('subscribe:telemetry');
      newSocket.emit('subscribe:strategy');
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected from API server');
      setConnected(false);
      setStoreConnected(false);
    });

    // Handle relay connection status
    newSocket.on('relay:status', (data: { connected: boolean }) => {
      console.log(`Relay status: ${data.connected ? 'connected' : 'disconnected'}`);
      setRelayConnected(data.connected);

      // Clear live data when relay disconnects
      if (!data.connected) {
        setLive(false);
      }
    });

    // Handle identification acknowledgment
    newSocket.on('identify:ack', (data: any) => {
      console.log('Webapp identified:', data);
    });

    // Handle available racers list
    newSocket.on('racers:list', (racers: Array<{ name: string; mock: boolean }>) => {
      console.log('Available racers:', racers);
      setAvailableRacers(racers);

      // Clear live data when no racers are connected
      if (racers.length === 0) {
        setLive(false);
      }
    });

    newSocket.on('telemetry:update', (data: { racerName: string; telemetry: ProcessedTelemetry }) => {
      updateTelemetry(data.racerName, data.telemetry);
    });

    newSocket.on('strategy:update', (strategyData: StrategyRecommendation) => {
      console.log('Strategy update received:', strategyData);
      updateStrategy(strategyData);
    });

    newSocket.on('session:update', (sessionData: any) => {
      console.log('Session update received:', sessionData);
      // Handle session updates from relay
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [updateTelemetry, updateStrategy, setStoreConnected, setRelayConnected, setAvailableRacers, setLive]);

  return { connected, socket };
}
