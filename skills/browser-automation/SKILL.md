# Browser Automation Skill

## When to Use
- Deploying sites (Render, Vercel, Netlify)
- Web scraping / data collection
- Testing web applications
- Signing into services
- Retrieving API keys from dashboards

## Tools Available

### 1. OpenClaw Browser Tool (Preferred)
Use the built-in `browser` tool for most automation:

```
browser action=start profile=openclaw    # Start isolated browser
browser action=navigate targetUrl=URL    # Navigate to URL
browser action=snapshot                   # Get page state (refs for clicking)
browser action=act request={kind:click, ref:REF}   # Click element
browser action=act request={kind:type, ref:REF, text:TEXT}  # Type text
browser action=act request={kind:press, key:Enter}  # Press key
browser action=screenshot                 # Take screenshot
```

### 2. Playwright CLI (Complex Scripts)
For multi-step workflows, use Playwright directly:

```bash
npx playwright test path/to/test.js    # Run test script
npx playwright codegen URL              # Record interactions
```

## Workflow Pattern

1. Start browser: `browser action=start profile=openclaw`
2. Navigate: `browser action=navigate targetUrl=https://example.com`
3. Snapshot to see page: `browser action=snapshot`
4. Find element ref from snapshot
5. Interact: `browser action=act request={kind:click, ref:REF}`
6. Repeat snapshot → interact until done
7. Screenshot for verification

## Tips
- Always snapshot before clicking to get fresh refs
- Use `profile=openclaw` for automation (isolated from Tyler's Chrome)
- Use `profile=chrome` only when Tyler's login session is needed
- For forms: snapshot → find input ref → type → find submit ref → click
- Wait for page loads between navigations
