/**
 * Socket.IO event handlers extracted from index.ts
 * Manages relay identification, telemetry broadcasting, strategy calculation, and session updates.
 */
import type { Server, Socket } from 'socket.io';
import type { ProcessedTelemetry } from '@iracing-race-engineer/shared';
import { logger } from '../../utils/logger.js';

// --- Types ---

interface RelayInfo {
  socketId: string;
  racerName: string;
  version: string;
  mock: boolean;
  connectedAt: Date;
}

interface InlineStrategy {
  fuelStrategy: {
    currentFuel: number;
    lapsUntilEmpty: number;
    averageConsumption: number;
    canFinish: boolean;
    refuelRequired: boolean;
  };
  tireStrategy: {
    currentWear: number;
    healthPercentage: number;
    canFinish: boolean;
    changeRecommended: boolean;
  };
  pitWindow: {
    optimalLap: number;
    windowStart: number;
    windowEnd: number;
    reason: string;
  } | null;
  recommendations: string[];
  lastUpdated: string;
}

interface StrategyCache {
  lastLap: number;
  lastStrategy: InlineStrategy;
}

export interface SocketHandlerState {
  relayConnections: Map<string, RelayInfo>;
  racerRelays: Map<string, string>;
  strategyCache: Map<string, StrategyCache>;
}

export interface TelemetryListener {
  onTelemetry: (racerName: string, telemetry: ProcessedTelemetry) => void;
}

// --- Handler registration ---

export function createSocketState(): SocketHandlerState {
  return {
    relayConnections: new Map(),
    racerRelays: new Map(),
    strategyCache: new Map(),
  };
}

export function registerSocketHandlers(
  io: Server,
  state: SocketHandlerState,
  listeners?: TelemetryListener[],
): void {
  io.on('connection', (socket: Socket) => {
    logger.info(`Client connected: ${socket.id}`);

    handleIdentify(io, socket, state);
    handleRelayTelemetry(io, socket, state, listeners);
    handleRelaySession(io, socket);
    handleSubscriptions(socket);
    handleDisconnect(io, socket, state);
  });
}

// --- Individual handlers ---

function handleIdentify(io: Server, socket: Socket, state: SocketHandlerState): void {
  socket.on(
    'identify',
    (data: {
      type: 'relay' | 'webapp';
      version?: string;
      racerName?: string;
      mock?: boolean;
    }) => {
      if (data.type === 'relay') {
        const racerName = data.racerName || 'Default Racer';
        const relayInfo: RelayInfo = {
          socketId: socket.id,
          racerName,
          version: data.version || 'unknown',
          mock: data.mock || false,
          connectedAt: new Date(),
        };

        state.relayConnections.set(socket.id, relayInfo);
        state.racerRelays.set(racerName, socket.id);
        socket.join('relay');
        socket.join(`relay:${racerName}`);

        logger.info(
          `✅ Python relay connected: ${socket.id}, racer: ${racerName}, version: ${data.version || 'unknown'}, mock: ${data.mock}`
        );

        socket.emit('identify:ack', {
          status: 'connected',
          racerName,
          message: 'Relay identified and ready to send telemetry',
        });

        const availableRacers = buildRacerList(state);
        logger.info(
          `🏁 Racer "${racerName}" connected${data.mock ? ' (MOCK MODE)' : ''} | ` +
          `Total racers: ${availableRacers.length} | ` +
          `Active: ${availableRacers.map(r => r.name).join(', ')}`
        );
        io.to('webapp').emit('racers:list', availableRacers);
        io.to('webapp').emit('relay:status', { connected: true, racerName });
      } else if (data.type === 'webapp') {
        socket.join('webapp');

        const availableRacers = buildRacerList(state);
        logger.info(
          `🌐 Webapp connected | ` +
          `Available racers: ${availableRacers.length > 0 ? availableRacers.map(r => r.name).join(', ') : 'None'}`
        );
        socket.emit('racers:list', availableRacers);
        socket.emit('relay:status', { connected: state.relayConnections.size > 0 });
      }
    }
  );
}

function handleRelayTelemetry(
  io: Server,
  socket: Socket,
  state: SocketHandlerState,
  listeners?: TelemetryListener[],
): void {
  socket.on('relay:telemetry', (data: { racerName: string; telemetry: ProcessedTelemetry }) => {
    const player = data.telemetry?.player;
    const fuel = data.telemetry?.fuel;
    const tires = data.telemetry?.tires;
    const session = data.telemetry?.session;

    logger.info(
      `📊 [${data.racerName}] Lap ${player?.lap || 0} | ` +
      `Speed: ${Math.round(player?.speed || 0)} km/h | ` +
      `Gear: ${player?.gear || 0} | ` +
      `Fuel: ${fuel?.level?.toFixed(1) || 0}L | ` +
      `Position: ${player?.position || 'N/A'}`
    );

    // Broadcast telemetry to all webapp clients
    io.to('webapp').emit('telemetry:update', {
      racerName: data.racerName,
      telemetry: data.telemetry,
    });
    io.to('telemetry').emit('telemetry:update', {
      racerName: data.racerName,
      telemetry: data.telemetry,
    });

    // Notify listeners (e.g., FileStore recording)
    if (listeners) {
      for (const listener of listeners) {
        listener.onTelemetry(data.racerName, data.telemetry);
      }
    }

    // Calculate and broadcast strategy (throttled to once per lap)
    try {
      const currentLap = player?.lap || 0;
      const cachedStrategy = state.strategyCache.get(data.racerName);

      if (!cachedStrategy || cachedStrategy.lastLap !== currentLap) {
        const fuelLapsRemaining = fuel?.lapsRemaining || 0;
        const raceLapsRemaining = session?.lapsRemaining || 0;

        if (!fuel?.lapsRemaining || fuel.lapsRemaining <= 0) {
          logger.debug(`📈 [${data.racerName}] Skipping strategy - no valid fuel data yet`);
          return;
        }

        const isUnlimitedSession = raceLapsRemaining > 10000;
        const MIN_FUEL_LAPS_THRESHOLD = 10;

        const rawTireHealth = tires ? (
          ((tires.lf?.avgWear || 0) + (tires.rf?.avgWear || 0) +
           (tires.lr?.avgWear || 0) + (tires.rr?.avgWear || 0)) / 4
        ) : 1.0;
        const avgTireHealth = Math.max(0, Math.min(1, rawTireHealth));
        const tireHealthPct = avgTireHealth * 100;

        const needsFuel = isUnlimitedSession
          ? fuelLapsRemaining < MIN_FUEL_LAPS_THRESHOLD
          : fuelLapsRemaining < raceLapsRemaining;
        const needsTires = tireHealthPct < 30;
        const needsPit = needsFuel || needsTires;

        let optimalPitLap = 0;
        if (needsFuel && needsTires) {
          const fuelUrgency = Math.max(0, fuelLapsRemaining - 2);
          const tireUrgency = tireHealthPct < 20 ? 1 : 3;
          optimalPitLap = currentLap + Math.min(fuelUrgency, tireUrgency);
        } else if (needsFuel) {
          optimalPitLap = currentLap + Math.max(0, fuelLapsRemaining - 2);
        } else if (needsTires) {
          optimalPitLap = currentLap + (tireHealthPct < 20 ? 1 : 3);
        }

        const estimatedFuelPerLap = (fuelLapsRemaining > 0 && fuel?.level)
          ? fuel.level / fuelLapsRemaining
          : 0;

        const strategy: InlineStrategy = {
          fuelStrategy: {
            currentFuel: fuel?.level || 0,
            lapsUntilEmpty: fuelLapsRemaining,
            averageConsumption: estimatedFuelPerLap,
            canFinish: !needsFuel,
            refuelRequired: needsFuel,
          },
          tireStrategy: {
            currentWear: avgTireHealth,
            healthPercentage: tireHealthPct,
            canFinish: !needsTires,
            changeRecommended: needsTires,
          },
          pitWindow: needsPit ? {
            optimalLap: optimalPitLap,
            windowStart: Math.max(currentLap + 1, optimalPitLap - 2),
            windowEnd: isUnlimitedSession ? optimalPitLap + 2 : Math.min(raceLapsRemaining, optimalPitLap + 2),
            reason: needsFuel && needsTires ? 'fuel + tires' : needsFuel ? 'fuel' : 'tires',
          } : null,
          recommendations: [],
          lastUpdated: new Date().toISOString(),
        };

        state.strategyCache.set(data.racerName, {
          lastLap: currentLap,
          lastStrategy: strategy,
        });

        io.to('webapp').emit('strategy:update', strategy);

        logger.debug(`📈 [${data.racerName}] Strategy calculated on lap ${currentLap} - Fuel: ${fuelLapsRemaining} laps, Tires: ${tireHealthPct.toFixed(0)}%`);
      }
    } catch (error) {
      logger.error({ error }, 'Failed to calculate strategy');
    }
  });
}

function handleRelaySession(io: Server, socket: Socket): void {
  socket.on('relay:session', (sessionData: { state: string; sessionType?: string; trackName?: string; [key: string]: unknown }) => {
    io.to('webapp').emit('session:update', sessionData);
    logger.info({ state: sessionData.state }, 'Session state update from relay');
  });
}

function handleSubscriptions(socket: Socket): void {
  socket.on('subscribe:telemetry', () => {
    socket.join('telemetry');
    socket.join('webapp');
    logger.info(`Client ${socket.id} subscribed to telemetry`);
  });

  socket.on('subscribe:strategy', () => {
    socket.join('telemetry');
    socket.join('webapp');
    logger.info(`Client ${socket.id} subscribed to strategy`);
  });

  socket.on('unsubscribe:telemetry', () => {
    socket.leave('telemetry');
    logger.info(`Client ${socket.id} unsubscribed from telemetry`);
  });
}

function handleDisconnect(io: Server, socket: Socket, state: SocketHandlerState): void {
  socket.on('disconnect', () => {
    const relayInfo = state.relayConnections.get(socket.id);
    if (relayInfo) {
      const racerName = relayInfo.racerName;
      state.relayConnections.delete(socket.id);
      state.racerRelays.delete(racerName);
      state.strategyCache.delete(racerName);

      const availableRacers = buildRacerList(state);
      logger.warn(
        `👋 Racer "${racerName}" disconnected | ` +
        `Remaining: ${availableRacers.length > 0 ? availableRacers.map(r => r.name).join(', ') : 'None'}`
      );
      io.to('webapp').emit('racers:list', availableRacers);
      io.to('webapp').emit('relay:status', {
        connected: state.relayConnections.size > 0,
        racerName,
        disconnected: true,
      });
    } else {
      logger.info(`Client disconnected: ${socket.id}`);
    }
  });
}

// --- Helpers ---

function buildRacerList(state: SocketHandlerState): { name: string; mock: boolean }[] {
  return Array.from(state.racerRelays.keys()).map((name) => ({
    name,
    mock: state.relayConnections.get(state.racerRelays.get(name)!)?.mock || false,
  }));
}
