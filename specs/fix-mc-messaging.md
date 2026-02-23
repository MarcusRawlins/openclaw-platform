# Fix Mission Control Messaging - Implementation Spec

**Assigned to:** Brunel (after Marcus tests the fix)  
**Priority:** URGENT
**Root Cause:** Device identity signing (Ed25519) is slow/hanging on mobile Safari, causing 10s handshake timeout

---

## Problem Statement

Mission Control shows "Disconnected" on mobile devices (iPhone Safari). Gateway logs show:
```
cause: handshake-timeout
handshakeMs: 10003
```

The WebSocket connects but times out waiting for the signed `connect` frame. Mobile Safari's crypto operations are too slow.

---

## Solution

Skip device identity signing when connecting from **trusted origins** (allowedOrigins). Use simple token auth instead.

---

## Implementation

### Step 1: Detect Trusted Origin

**File:** `/lib/use-gateway.ts` (line ~25, in useEffect)

**Before connection, check if origin is trusted:**

```typescript
const settings = loadSettings();
const gwUrl = settings.gatewayUrl;
const gwToken = settings.gatewayToken;

if (!gwUrl || !gwToken) return;

// NEW: Check if we're connecting from a trusted origin
const isTrustedOrigin = window.location.origin === 'http://localhost:3100' ||
                        window.location.origin === 'http://192.168.68.147:3100' ||
                        window.location.origin === 'http://marcuss-mac-mini.taild34a1b.ts.net:3100' ||
                        window.location.origin === 'http://100.99.154.65:3100';
```

### Step 2: Pass Trusted Flag to GatewayClient

**File:** `/lib/gateway-client.ts`

**Update constructor:**

```typescript
constructor(opts: {
  url: string;
  token: string;
  skipDeviceIdentity?: boolean;  // NEW
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onEvent?: GatewayEventHandler;
}) {
  this.url = opts.url;
  this.token = opts.token;
  this.skipDeviceIdentity = opts.skipDeviceIdentity || false;  // NEW
  // ... rest
}
```

### Step 3: Simplify Connect Frame for Trusted Origins

**File:** `/lib/gateway-client.ts` (in sendConnectFrame method, ~line 60)

**Replace device identity flow with simple connect:**

```typescript
private async sendConnectFrame() {
  if (!this.ws) return;

  const id = `dash-${++this.idCounter}`;
  
  if (this.skipDeviceIdentity) {
    // Simplified connect for trusted origins (no device signing)
    const msg = {
      type: "req",
      id,
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "openclaw-control-ui",
          displayName: "Operations Dashboard",
          version: "1.0.0",
          platform: "web",
          mode: "webchat",
        },
        // No device field = token-only auth
        auth: {
          token: this.token,
        },
      },
    };
    
    this.ws.send(JSON.stringify(msg));
    return new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
    });
  }
  
  // Original device identity flow for untrusted origins
  if (!this.identity) {
    this.identity = await getOrCreateIdentity();
  }
  
  // ... existing signing code ...
}
```

### Step 4: Wire It Together

**File:** `/lib/use-gateway.ts` (line ~35, creating GatewayClient)

```typescript
const client = new GatewayClient({
  url: gwUrl,
  token: gwToken,
  skipDeviceIdentity: isTrustedOrigin,  // NEW
  onConnected: () => {
    setConnected(true);
    addFeedItem("marcus", "Dashboard connected to OpenClaw gateway", "OpenClaw");
    fetchGatewayData(client);
  },
  // ... rest
});
```

---

## Testing Checklist

### Before Implementation:
- [ ] Marcus tests WebSocket connection from desktop (should work)
- [ ] Marcus tests from iPhone via Tailscale (currently times out)

### After Implementation:
- [ ] Build passes (no TypeScript errors)
- [ ] Desktop: MC connects and shows agent status
- [ ] Desktop: Can send messages in chat panel
- [ ] iPhone (Tailscale): MC connects within 2 seconds
- [ ] iPhone (Tailscale): Can send messages in chat panel
- [ ] iPhone (Tailscale): No handshake timeout errors in Gateway logs

---

## Acceptance Criteria

1. Mission Control connects successfully from all allowed origins
2. No handshake timeouts in Gateway logs
3. Mobile Safari connects in <2 seconds (vs 10s timeout)
4. Chat/messaging works on both desktop and mobile
5. Device identity signing still works for untrusted origins
6. No regression on localhost access

---

## Rollback Plan

If this breaks something:
1. Revert the `skipDeviceIdentity` changes
2. Increase Gateway handshake timeout to 30s (band-aid)
3. Investigate Safari crypto performance separately

---

## Notes

- This only affects Control UI (webchat mode)
- Agents still use full device identity
- allowedOrigins already provides origin-based trust
- No security regression (token auth still required)
