# iRacing Telemetry Relay — TypeScript

WebSocket relay server that reads from the iRacing SDK on Windows and streams
live telemetry to any connected client (macOS race engineer app, browser, etc.).

## Directory structure

```
tools/relay/
├── src/
│   ├── index.ts          — Entry point, CLI args parsing
│   ├── iracing-client.ts  — iRacing SDK wrapper with typed events
│   ├── ws-server.ts       — WebSocket server, client management
│   ├── display.ts         — Terminal dashboard (live-updating stats)
│   ├── encoder.ts         — Delta encoding for bandwidth optimisation
│   └── types.ts           — Shared types for telemetry data
├── package.json
├── tsconfig.json
└── README.md
```

## Quick start

### Windows (production — iRacing must be running)

```powershell
cd tools/relay
npm install
npm run build
node dist/index.js
```

### macOS / Linux (mock mode — no iRacing needed)

```bash
cd tools/relay
npm install
npm run dev          # tsx + --mock flag
# or after building:
npm run start:mock
```

## CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `--port <n>` | `3002` | WebSocket port |
| `--rate <n>` | `60` | Telemetry Hz |
| `--compress` | off | Enable per-message deflate |
| `--mock` | off | Generate fake telemetry (no iRacing needed) |

## Terminal dashboard

The relay renders a live-updating dashboard showing:

- Connection status & mock mode indicator
- Connected client count & bandwidth out
- Track name & car
- Speed, RPM, gear, throttle/brake bars
- Lap number, position, best/last lap times
- Fuel level & laps remaining
- Tire temperatures (all four corners)
- Track conditions (air temp, humidity, wind)

## Delta encoding

Only fields that changed by ≥ **0.1%** relative to the previous frame are
included in the wire payload. The first frame (or the first frame after a
client-triggered reset) is always a full snapshot.

Typical savings: ~80–95% bandwidth reduction at 60 Hz vs. sending full frames.

## Development

```bash
# Run tests (vitest)
npm test

# Watch mode
npm run test:watch

# Type-check only
npm run type-check
```

## iRacing SDK (Windows only)

The relay uses [`node-irsdk`](https://github.com/apihlaja/node-irsdk), which
requires native build tools on Windows:

1. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
   — select **"Desktop development with C++"**
2. `npm install node-irsdk`

On macOS/Linux use `--mock` to generate synthetic telemetry without iRacing.
