# Pitcrew iRacing Relay - Quick Reference Card

## 🚀 Quick Start

**Double-click:** `connect-to-pitcrew.bat`
**Then start iRacing and join a session!**

---

## 🌐 Web Dashboard

**URL:** https://pitcrew-iracing.onrender.com

View your real-time telemetry, strategy, and analysis in your browser!

---

## ✅ What You Should See

```
✅ Connected to API server!
🏁 Waiting for iRacing...
🎮 iRacing detected!
📊 Streaming telemetry at 60 Hz
```

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't connect | Check internet, ping pitcrew-iracing.onrender.com |
| iRacing not detected | Make sure you're in an active session, not menu |
| Antivirus blocks | Add exception for iRacing-Relay-v3.0.exe |
| Disconnects | Auto-reconnect is enabled, check internet stability |

---

## 📞 Connection Info

- **Host:** pitcrew-iracing.onrender.com
- **Port:** 443 (HTTPS/WSS)
- **Secure:** Yes (Encrypted)
- **Rate:** 60 Hz

---

## 💻 Manual Command

```cmd
iRacing-Relay-v3.0.exe --host pitcrew-iracing.onrender.com --port 443 --secure
```

---

## 📊 Data Usage

~10-20 KB/s = ~40 MB/hour

---

## ✨ Features

- ✅ Real-time telemetry streaming
- ✅ Race strategy recommendations
- ✅ Fuel & tire management
- ✅ Lap time analysis
- ✅ Auto-reconnect
- ✅ Encrypted connection

---

**Need help? Read WINDOWS_SETUP_GUIDE.md**
