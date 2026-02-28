# Browser Automation Skill

## When to Use Browser Tool vs Playwright

### Use OpenClaw `browser` tool when:
- ✅ You need quick browser automation (screenshots, simple navigation, form fills)
- ✅ Working within OpenClaw agent workflows
- ✅ Need to interact with user's existing Chrome session (profile="chrome")
- ✅ Simple tasks: screenshot a page, click a button, fill a form
- ✅ Automated testing or monitoring tasks

### Use Playwright directly when:
- ✅ Complex multi-step automation requiring custom logic
- ✅ Need specific Playwright features (network interception, mobile emulation)
- ✅ Building standalone automation scripts
- ✅ Performance-critical operations
- ✅ Advanced browser control (multiple contexts, precise timing)

**Default choice:** Use `browser` tool. It's simpler and integrated with OpenClaw.

## Browser Tool Profiles

### `profile="openclaw"` (Default for automation)
- Isolated Chrome instance managed by OpenClaw
- No manual user action required
- Perfect for automated tasks
- Fresh browser session each time

```javascript
// Start openclaw browser
browser action=start profile=openclaw

// Open page
browser action=open profile=openclaw targetUrl=https://example.com
```

### `profile="chrome"` (For user's Chrome)
- Connects to user's existing Chrome browser
- **Requires:** User clicks OpenClaw extension icon on target tab
- Access to logged-in sessions
- Use when you need user's cookies/auth

```javascript
// User must click extension icon first!
browser action=start profile=chrome
browser action=snapshot profile=chrome targetId=<tab-id>
```

## Common Patterns

### 1. Take a Screenshot

```javascript
// Start browser
browser action=start profile=openclaw

// Open page
const result = browser action=open profile=openclaw targetUrl=https://example.com

// Wait for load (optional)
browser action=act profile=openclaw request={
  kind: "wait",
  timeMs: 2000,
  targetId: result.targetId
}

// Screenshot
browser action=screenshot profile=openclaw targetId=result.targetId fullPage=true

// Clean up
browser action=stop profile=openclaw
```

### 2. Fill and Submit a Form

```javascript
// Start and navigate
browser action=start profile=openclaw
const page = browser action=open profile=openclaw targetUrl=https://example.com/signup

// Snapshot to get refs
const snap = browser action=snapshot profile=openclaw targetId=page.targetId refs=aria

// Fill fields using refs from snapshot
browser action=act profile=openclaw request={
  kind: "fill",
  fields: [
    {ref: "email-input", text: "user@example.com"},
    {ref: "password-input", text: "securepass123"}
  ],
  targetId: page.targetId
}

// Submit
browser action=act profile=openclaw request={
  kind: "click",
  ref: "submit-button",
  submit: true,
  targetId: page.targetId
}

// Wait for navigation
browser action=act profile=openclaw request={
  kind: "wait",
  timeMs: 3000,
  targetId: page.targetId
}

// Screenshot confirmation
browser action=screenshot profile=openclaw targetId=page.targetId
```

### 3. Login to a Service

```javascript
// Navigate to login
browser action=start profile=openclaw
const page = browser action=open profile=openclaw targetUrl=https://service.com/login

// Get page structure
const snap = browser action=snapshot profile=openclaw targetId=page.targetId refs=aria

// Type credentials slowly (for security detection)
browser action=act profile=openclaw request={
  kind: "type",
  ref: "username",
  text: "myuser@email.com",
  slowly: true,
  targetId: page.targetId
}

browser action=act profile=openclaw request={
  kind: "type",
  ref: "password",
  text: "mypassword",
  slowly: true,
  targetId: page.targetId
}

// Click login
browser action=act profile=openclaw request={
  kind: "click",
  ref: "login-button",
  targetId: page.targetId
}

// Wait for dashboard
browser action=act profile=openclaw request={
  kind: "wait",
  timeMs: 5000,
  targetId: page.targetId
}
```

### 4. Extract Data from Page

```javascript
// Navigate
browser action=start profile=openclaw
const page = browser action=open profile=openclaw targetUrl=https://example.com/data

// Get page snapshot with aria refs
const snap = browser action=snapshot profile=openclaw targetId=page.targetId refs=aria snapshotFormat=ai

// The snapshot includes text content - parse it
// For complex extraction, use evaluate:
browser action=act profile=openclaw request={
  kind: "evaluate",
  fn: "() => { return document.querySelectorAll('.price').map(el => el.textContent); }",
  targetId: page.targetId
}
```

### 5. Handle Dialogs/Popups

```javascript
// Set dialog handler before action that triggers it
browser action=dialog profile=openclaw accept=true promptText="optional text for prompt"

// Or dismiss
browser action=dialog profile=openclaw accept=false
```

### 6. Upload Files

```javascript
// Set files to upload
browser action=upload profile=openclaw paths=["/path/to/file1.pdf", "/path/to/file2.jpg"]

// Then click the file input or submit button
browser action=act profile=openclaw request={
  kind: "click",
  ref: "file-upload-button",
  targetId: page.targetId
}
```

## Error Handling

### Common Errors and Solutions

#### "Can't reach the OpenClaw browser control service"
**Cause:** Gateway not running or browser service crashed  
**Fix:** Restart gateway: `openclaw gateway restart`

#### "Chrome extension relay is running, but no tab is connected"
**Cause:** Using `profile="chrome"` without connected tab  
**Fix:** 
- Switch to `profile="openclaw"` for automation
- OR have user click OpenClaw extension icon on Chrome tab

#### "Target not found" or "targetId invalid"
**Cause:** Tab was closed or targetId is stale  
**Fix:** Get fresh targetId from `tabs` or `open` action

#### Timeout waiting for selector
**Cause:** Element not present or wrong ref  
**Fix:**
1. Take snapshot first to verify refs
2. Use `refs=aria` for stable identifiers
3. Increase timeout or add explicit wait

#### "Navigation timeout"
**Cause:** Page slow to load or infinite loading  
**Fix:**
1. Increase timeoutMs
2. Wait for specific element instead of full page load
3. Check if page actually loaded (screenshot)

### Error Recovery Pattern

```javascript
try {
  // Start browser
  browser action=start profile=openclaw
  
  // Attempt task
  const page = browser action=open profile=openclaw targetUrl=https://example.com
  
  // If action fails, take screenshot for debugging
  browser action=screenshot profile=openclaw targetId=page.targetId
  
} catch (error) {
  // Log error
  console.log("Browser automation failed:", error)
  
  // Screenshot current state if possible
  try {
    browser action=screenshot profile=openclaw
  } catch {}
  
} finally {
  // Always clean up
  browser action=stop profile=openclaw
}
```

## Best Practices

1. **Always clean up:** Stop the browser when done to free resources
2. **Use refs wisely:** Prefer `refs=aria` for stable element references
3. **Screenshot liberally:** Take screenshots at key steps for debugging
4. **Handle errors gracefully:** Expect things to fail, capture state when they do
5. **Respect rate limits:** Use `slowly=true` for typing sensitive info
6. **Profile selection:** Default to `openclaw` unless you need user's Chrome session
7. **Timeouts:** Set reasonable timeouts (default often too short)
8. **Snapshots first:** Take snapshot before acting to verify element refs

## Typical Task Flows

### Research Task
1. Start browser
2. Open search engine
3. Type query
4. Screenshot results
5. Click top result
6. Snapshot page content
7. Screenshot article
8. Stop browser

### Account Signup
1. Start browser
2. Navigate to signup page
3. Snapshot form
4. Fill fields
5. Submit
6. Wait for confirmation
7. Screenshot success page
8. Extract confirmation details
9. Stop browser

### Monitoring Task
1. Start browser
2. Open target page
3. Screenshot current state
4. Compare with previous screenshot
5. Extract key metrics
6. Stop browser
7. Schedule next check (cron)

## Integration with Other Skills

### With Email
- Retrieve signup confirmation links from email
- Navigate to link in browser
- Complete verification
- Screenshot result

### With Message/Notifications
- Browser task completes
- Screenshot result
- Send notification with screenshot via message tool

### With Cron
- Schedule regular browser checks
- Monitor website changes
- Automated login to refresh sessions

## Debugging Tips

1. **Take snapshots:** See page structure before acting
2. **Use screenshots:** Visual confirmation of state
3. **Check console:** `browser action=console` for page errors
4. **Slow down:** Use `slowly=true` or explicit waits
5. **Verify refs:** Snapshot with both `refs=role` and `refs=aria` to compare
6. **Network tab:** Check if resources loaded (screenshot shows blank page?)

## Examples Directory

More examples in: `/workspace/skills/browser-automation/examples/`

---

**Created:** 2026-02-27  
**Author:** Marcus Rawlins  
**Related:** BROWSER-CONTROL-TROUBLESHOOTING.md
