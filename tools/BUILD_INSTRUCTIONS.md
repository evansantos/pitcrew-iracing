# Building iRacing Relay Executable

This guide explains how to build a standalone Windows executable (.exe) for the iRacing Relay Server.

## Why Build an Executable?

The executable allows you to:
- Run the relay without installing Python
- Distribute to users easily
- Simplify deployment on Windows machines
- Bundle all dependencies in a single file

## Prerequisites

### On Windows (Recommended)
- Python 3.11 or higher
- iRacing installed (for testing)

### On Mac/Linux (Cross-compile)
- Python 3.11 or higher
- PyInstaller (will be installed by build script)

## Quick Build

### Windows

1. Open Command Prompt
2. Navigate to the tools directory:
   ```cmd
   cd tools
   ```
3. Run the build script:
   ```cmd
   build-relay.bat
   ```

### Mac/Linux

```bash
cd tools
./build-relay.sh
```

## Manual Build

If you prefer to build manually:

```bash
# Install dependencies
pip install pyirsdk python-socketio pyinstaller

# Build with PyInstaller
pyinstaller --onefile \
    --name "iRacing-Relay-v3.0" \
    --console \
    --clean \
    windows-relay-server-socketio.py

# The executable will be in: dist/iRacing-Relay-v3.0.exe
```

## Configuration

### Before Building

Edit `windows-relay-server-socketio.py` and set your default configuration:

```python
# Configuration - UPDATE THESE TO MATCH YOUR API SERVER
API_HOST = 'localhost'  # Change to your API server IP/hostname
API_PORT = 3001         # Socket.IO port from your API
TELEMETRY_RATE = 60     # Hz
```

### After Building

Users can still modify configuration by editing the script before running, or you can create a config file system.

## Build Output

After building, you'll find:

```
tools/
├── dist/
│   └── iRacing-Relay-v3.0.exe    # Your executable!
├── build/                         # Temporary build files (can delete)
└── iRacing-Relay-v3.0.spec       # PyInstaller spec file
```

## Distributing the Executable

### What to Share

Share only the executable:
```
dist/iRacing-Relay-v3.0.exe
```

File size: ~15-20 MB (includes Python runtime and all dependencies)

### User Instructions

1. Copy `iRacing-Relay-v3.0.exe` to your Windows machine
2. Double-click to run
3. Edit the configuration if needed (or open with a text editor... wait, it's binary!)

**Note:** For user configuration, consider creating a `config.ini` file approach or using command-line arguments.

## Advanced: Adding Configuration File Support

To make the executable more user-friendly, you can add a config file:

### 1. Create `relay-config.ini` template:

```ini
[API]
host = localhost
port = 3001

[Telemetry]
rate = 60
```

### 2. Modify Python script to read config:

```python
import configparser

config = configparser.ConfigParser()
config.read('relay-config.ini')

API_HOST = config.get('API', 'host', fallback='localhost')
API_PORT = config.getint('API', 'port', fallback=3001)
TELEMETRY_RATE = config.getint('Telemetry', 'rate', fallback=60)
```

### 3. Rebuild the executable

Users can then edit `relay-config.ini` alongside the .exe file.

## Troubleshooting

### "Python not found"
Install Python 3.11+ from https://www.python.org/ and ensure it's in your PATH.

### "pyinstaller: command not found"
Run: `pip install pyinstaller`

### "ImportError: No module named pyirsdk"
The build script should install this, but you can manually install:
```bash
pip install pyirsdk python-socketio
```

### Executable is too large
PyInstaller bundles the entire Python runtime. To reduce size:
- Use `--onefile` (already used)
- Use UPX compression: `pyinstaller --onefile --upx-dir=/path/to/upx ...`
- Remove unnecessary imports from the script

### Antivirus blocks the executable
This is common with PyInstaller executables:
1. Add exception in antivirus
2. Sign the executable with a code signing certificate
3. Build on the target machine instead of cross-compiling

### Testing the executable
```cmd
# Test basic functionality
iRacing-Relay-v3.0.exe

# Should output:
# ==================================================
# iRacing Relay Server - Version 3.0
# Socket.IO Client Mode
# ==================================================
```

## Build Options Reference

### PyInstaller Flags Used

- `--onefile`: Bundle everything into a single executable
- `--name`: Name of the output executable
- `--console`: Show console window (necessary for logging)
- `--clean`: Clean PyInstaller cache before building
- `--noconfirm`: Overwrite output directory without asking

### Additional Useful Flags

- `--windowed`: Hide console window (not recommended for this app)
- `--icon=icon.ico`: Add custom icon
- `--add-data`: Include additional files
- `--hidden-import`: Force include modules PyInstaller might miss
- `--upx-dir`: Use UPX for compression

## Continuous Integration

For automated builds, add to your CI/CD pipeline:

### GitHub Actions Example

```yaml
name: Build Windows Executable

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          pip install pyirsdk python-socketio pyinstaller
      - name: Build executable
        run: |
          cd tools
          pyinstaller --onefile --name "iRacing-Relay-v3.0" --console windows-relay-server-socketio.py
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: iRacing-Relay-Windows
          path: tools/dist/iRacing-Relay-v3.0.exe
```

## Version Management

Update version in script header:
```python
print("iRacing Relay Server - Version 3.0")
```

And in build script name:
```bash
--name "iRacing-Relay-v3.0"
```

## Next Steps

After building:
1. Test the executable on a clean Windows machine
2. Document the configuration process for end users
3. Consider adding a GUI for configuration
4. Set up automatic updates system
5. Add telemetry/error reporting

## Support

For build issues:
- Check PyInstaller documentation: https://pyinstaller.org/
- Verify Python version compatibility
- Test on target Windows version (Windows 10/11)
- Check antivirus logs if executable doesn't run
