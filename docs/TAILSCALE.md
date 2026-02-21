# Tailscale VPN Setup for Mission Control

**Status:** ✅ Live and connected

## Quick Reference

- **Mission Control (remote):** http://marcuss-mac-mini.taild34a1b.ts.net:3100
- **Mission Control (local):** http://localhost:3100 or http://192.168.68.147:3100
- **Tailscale IP:** 100.99.154.65
- **Account:** jtyler.reese@gmail.com

## Connected Devices

| Device | Tailscale IP | OS |
|--------|-------------|-----|
| Marcus's Mac mini | 100.99.154.65 | macOS |
| iPhone | 100.97.254.31 | iOS |
| Tyler's MacBook Air | 100.109.85.24 | macOS |
| Reese Mac mini (Brady) | 100.115.204.111 | macOS |

## How to Access Mission Control Remotely

1. Make sure Tailscale is running on your device (phone/laptop)
2. Open browser and go to: **http://marcuss-mac-mini.taild34a1b.ts.net:3100**
3. That's it.

## Installing Tailscale on New Devices

### iPhone/iPad
1. Download "Tailscale" from the App Store
2. Log in with **jtyler.reese@gmail.com**
3. Enable the VPN profile when prompted

### macOS
1. Download from: https://tailscale.com/download/mac
2. Install and log in with **jtyler.reese@gmail.com**

### Windows
1. Download from: https://tailscale.com/download/windows
2. Install and log in with **jtyler.reese@gmail.com**

## Troubleshooting

### Can't connect to Mission Control?

1. **Check Tailscale is connected:**
   ```bash
   tailscale status
   ```

2. **Verify Mission Control is running:**
   ```bash
   curl http://localhost:3100
   ```

3. **Try the IP directly:**
   http://100.99.154.65:3100

4. **Restart Tailscale:** Quit and relaunch from Applications/menu bar

5. **Restart Mission Control:**
   ```bash
   cd /Users/marcusrawlins/.openclaw/workspace/mission_control
   bun run dev
   ```

## Security

- Encrypted peer-to-peer mesh network
- Only devices authenticated with your Tailscale account can access
- No open firewall ports or router config needed
- End-to-end encrypted traffic

### Firewall Access Control

Mission Control port 3100 is protected by macOS firewall (pf):

**Allowed devices:**
- iPhone (100.97.254.31)
- Tyler's MacBook Air (100.109.85.24)
- Marcus's Mac mini (100.99.154.65)
- Local network (192.168.68.0/24)

**Blocked devices:**
- Brady's Mac mini (100.115.204.111) - cannot access port 3100

Firewall rules persist across reboots. Configuration file: `/etc/pf.anchors/com.mission-control`
