# Browser Control Infrastructure

## Status: WORKING ✅

## Profiles
- **openclaw**: Isolated browser for automation (port 18800). Use for: deployments, web scraping, testing.
- **chrome**: Attach to existing Chrome tabs via relay extension. Use for: sites requiring Tyler's login.

## Starting Browser
```
browser action=start profile=openclaw
```

## Key Commands
- `browser action=status` - Check if browser is running
- `browser action=start profile=openclaw` - Start isolated browser
- `browser action=snapshot` - Capture page state
- `browser action=navigate targetUrl=URL` - Go to URL
- `browser action=act request={kind:click, ref:REF}` - Click element

## For Agents (Brunel)
Brunel has browser tool denied in config. For tasks requiring browser automation:
1. Remove browser from Brunel's deny list in config, OR
2. Have Marcus do the browser work and hand results to Brunel

## Playwright
- Installed: v1.58.2
- Path: /opt/homebrew/bin/playwright
- Use for: complex automation scripts, testing
