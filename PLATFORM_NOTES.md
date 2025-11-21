# Platform Compatibility Notes

## iRacing SDK Limitations

### Windows Only
The **iRacing SDK** and `node-irsdk` package are **Windows-only** because:
- iRacing itself only runs on Windows
- The SDK uses Windows memory-mapped files to access telemetry
- There's no official macOS or Linux support

### Development on macOS/Linux

Good news! You can still develop on macOS/Linux:

1. **Mock Mode Development**
   - The API runs in "mock mode" when `node-irsdk` is unavailable
   - Perfect for building UI, testing features, and development
   - All other functionality works normally

2. **What Works**
   - ✅ All frontend development
   - ✅ API development and testing
   - ✅ Database and Redis integration
   - ✅ WebSocket communication
   - ✅ Strategy calculations
   - ✅ UI/UX development
   - ✅ Mock telemetry data

3. **What Requires Windows**
   - ❌ Live iRacing telemetry reading
   - ❌ Real-time race data from iRacing

## Recommended Development Setup

### Option 1: macOS/Linux for Development
```bash
# Install without optional dependencies
pnpm install --no-optional

# Everything works except live iRacing telemetry
pnpm dev
```

**Best for**: UI development, API logic, testing, most feature work

### Option 2: Windows for Production Testing
```bash
# On Windows, install with iRacing SDK
pnpm install

# Full iRacing integration available
pnpm dev
```

**Best for**: Testing live telemetry, final integration testing

### Option 3: Hybrid Approach (Recommended)
1. Develop on macOS/Linux (faster, better dev tools)
2. Use mock telemetry data
3. Test on Windows VM or separate machine when needed

## Installing on Different Platforms

### macOS/Linux (Development)
```bash
# Clone repository
git clone https://github.com/yourusername/iracing-race-engineer.git
cd iracing-race-engineer

# Install dependencies (skip optional Windows-only packages)
pnpm install --no-optional

# Start development
pnpm dev
```

The application will log:
```
[INFO] node-irsdk not available (Windows only) - telemetry will use mock data
[INFO] TelemetryService initialized in MOCK mode (development)
```

### Windows (Production)
```bash
# Clone repository
git clone https://github.com/yourusername/iracing-race-engineer.git
cd iracing-race-engineer

# Install all dependencies including iRacing SDK
pnpm install

# Start with live telemetry
pnpm dev
```

The application will log:
```
[INFO] node-irsdk loaded successfully
[INFO] Connecting to iRacing SDK...
```

## Mock Telemetry Data

When running in mock mode, you can:

1. **Generate Mock Data**
   - Create sample telemetry in `apps/api/src/modules/telemetry/mock-data.ts`
   - Simulate race scenarios for testing
   - Test edge cases and unusual situations

2. **Replay Recorded Sessions**
   - Record real telemetry on Windows
   - Replay on any platform for development
   - Test with realistic data

3. **Use Sample Data**
   - We'll provide sample telemetry files
   - Cover various tracks and car classes
   - Include common race scenarios

## Docker Considerations

The Docker containers work on all platforms:
- PostgreSQL: ✅ All platforms
- Redis: ✅ All platforms
- API: ✅ All platforms (mock mode on non-Windows)
- Web: ✅ All platforms

## CI/CD Pipeline

Recommended setup:
- **Development CI**: Run on Linux runners (faster, cheaper)
- **Integration Tests**: Use mock telemetry
- **Production Deploy**: Windows server for live telemetry

## Future Considerations

Potential solutions for cross-platform telemetry:
1. **Telemetry Proxy**: Windows machine streams to API server
2. **Cloud Service**: Windows VM in cloud handles telemetry
3. **Electron App**: Package for Windows with iRacing integration

## FAQ

**Q: Can I use this on macOS?**
A: Yes! Everything works except live iRacing telemetry. Perfect for development.

**Q: Do I need Windows to contribute?**
A: No! Most development can be done on any platform.

**Q: How do I test telemetry features on macOS?**
A: Use mock data or recorded telemetry sessions.

**Q: Can the API run on Linux in production?**
A: Yes, but you'll need a Windows machine nearby to feed it telemetry data.

**Q: What about Wine or compatibility layers?**
A: iRacing doesn't work reliably with Wine. Native Windows is required.

## Platform-Specific Package Installation

The `package.json` handles this automatically:

```json
{
  "dependencies": {
    // ... all cross-platform dependencies
  },
  "optionalDependencies": {
    "node-irsdk": "^2.1.6"  // Only installs on Windows
  }
}
```

On macOS/Linux:
```bash
pnpm install --no-optional  # Skips node-irsdk
```

On Windows:
```bash
pnpm install  # Installs everything including node-irsdk
```

## Contributing from Any Platform

You can contribute to:
- Frontend development (any platform)
- API architecture (any platform)
- Strategy algorithms (any platform)
- Documentation (any platform)
- Testing framework (any platform)
- UI/UX improvements (any platform)

Only telemetry integration specifically requires Windows for testing.

---

**Bottom line**: Develop on the platform you prefer. Test on Windows when you need live iRacing integration.
