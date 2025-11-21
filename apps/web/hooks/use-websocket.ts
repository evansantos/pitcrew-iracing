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

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    const newSocket = io(wsUrl, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      setStoreConnected(true);
      newSocket.emit('subscribe:telemetry');
      newSocket.emit('subscribe:strategy');
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      setStoreConnected(false);
    });

    newSocket.on('telemetry:update', (telemetryData: ProcessedTelemetry) => {
      updateTelemetry(telemetryData);
    });

    newSocket.on('strategy:update', (strategyData: StrategyRecommendation) => {
      console.log('Strategy update received:', strategyData);
      updateStrategy(strategyData);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [updateTelemetry, updateStrategy, setStoreConnected]);

  return { connected, socket };
}
