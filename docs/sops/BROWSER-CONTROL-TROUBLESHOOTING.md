# Browser Control Troubleshooting

## Issue: Browser Tool Not Working

**Date:** 2026-02-27  
**Reporter:** Marcus Rawlins  
**Status:** RESOLVED

### Problem

Browser tool was failing with the error:
```
Chrome extension relay is running, but no tab is connected. 
Click the OpenClaw Chrome extension icon on a tab to attach it (profile "chrome").
```

### Root Cause

The browser control was configured to use `profile="chrome"` which requires:
- Chrome browser running
- OpenClaw Chrome extension installed
- A tab actively connected via the extension (user clicks the toolbar icon)

This mode is useful for taking over existing Chrome sessions but requires manual user action to connect a tab.

### Solution

Use `profile="openclaw"` instead for automated browser control:
- Launches an isolated Chrome instance
- Managed by OpenClaw directly via CDP (Chrome DevTools Protocol)
- No manual connection required
- Full automation capability

### Browser Profile Guide

#### When to use `profile="chrome"`
- You want to interact with user's existing Chrome tabs
- User is actively browsing and wants agent assistance
- Need access to logged-in sessions in user's Chrome
- **Requires:** User to click OpenClaw extension icon on the target tab

#### When to use `profile="openclaw"`
- Automated browser tasks (scraping, testing, screenshots)
- Fresh browser sessions needed
- No user interaction available
- Default choice for agent-initiated browsing

### Testing

Verified browser control is working:
```bash
# Start openclaw browser
browser action=start profile=openclaw

# Open a page
browser action=open profile=openclaw targetUrl=https://example.com

# Take screenshot to verify
browser action=screenshot profile=openclaw

# Stop browser
browser action=stop profile=openclaw
```

### Recommendations

1. **Default to openclaw profile** for agent-initiated browser tasks
2. **Use chrome profile** only when explicitly needing user's Chrome session
3. **Document in skills** which profile to use for different scenarios
4. Add profile selection to browser automation skill documentation

### Related Files
- Skill documentation: `/workspace/skills/browser-automation/SKILL.md` (to be created)
- Browser tool reference: OpenClaw browser tool docs
