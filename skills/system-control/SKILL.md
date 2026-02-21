# System Control - Complete Mac Automation

**Purpose:** Full control over Marcus's Mac mini - GUI, applications, system settings, monitoring.

## Decision Tree: Which Tool to Use

### For GUI Automation (clicking, typing, visual inspection)
→ **Use Peekaboo**

Examples:
- Clicking through installers
- Filling out forms in apps
- Navigating System Settings
- Interacting with dialog boxes
- Clicking menu items
- Taking screenshots to see what's on screen

**Workflow:**
1. `peekaboo see --annotate --path /tmp/screenshot.png` - capture + label UI elements
2. Read the screenshot to identify element IDs
3. `peekaboo click --on [element-id]` - click the target
4. `peekaboo type "text"` - type into focused fields
5. `peekaboo press return` - submit/confirm

### For Web Browsers (pages, forms, scraping)
→ **Use browser tool**

Examples:
- Navigating websites
- Filling web forms
- Extracting data from pages
- Managing tabs
- Taking page screenshots

**Note:** Requires Chrome extension relay to be attached (user must click extension icon)

### For Terminal/Command Line Operations
→ **Use exec tool**

Examples:
- Running shell commands
- Installing software (brew, npm, etc.)
- File operations (mv, cp, rm)
- System configuration (pfctl, launchd)
- Process management
- Git operations

**Tip:** Use `echo "marcus" | sudo -S [command]` for sudo operations

### For File Management
→ **Use Read/Write/Edit tools**

Examples:
- Reading config files
- Writing documentation
- Creating scripts
- Editing source code
- Moving/organizing files

### For Application Management
→ **Use Peekaboo app commands**

Examples:
- Launching apps: `peekaboo app launch "AppName"`
- Quitting apps: `peekaboo app quit "AppName"`
- Switching apps: `peekaboo app switch "AppName"`
- Listing apps: `peekaboo list apps --json`

### For System Settings Changes
→ **Combination: exec + Peekaboo**

Examples:
- Firewall rules: `exec` (pfctl)
- Network settings: `Peekaboo` (System Settings UI)
- Permissions: `Peekaboo` (System Settings → Privacy & Security)
- Display settings: `exec` (defaults write) or `Peekaboo`

## Required Permissions

### Peekaboo Permissions
**Location:** System Settings → Privacy & Security

1. **Screen Recording** (Required)
   - Allows Peekaboo to capture screenshots
   - Needed for `see`, `image`, `capture` commands

2. **Accessibility** (Required)
   - Allows Peekaboo to control UI elements
   - Needed for `click`, `type`, `press`, `drag` commands

**How to Grant:**
```bash
# This will prompt for permissions
peekaboo permissions

# Then manually approve in System Settings
```

### Terminal Permissions
- Already granted (Marcus user account with sudo)
- Password: "marcus"

### Browser Control Permissions
- Chrome extension installed
- Needs manual tab attachment (click extension icon)

## Common Patterns

### Pattern 1: Install & Configure Software with GUI

**Scenario:** Installing software that has a GUI installer (like Tailscale)

**Steps:**
1. Download installer (exec: `curl` or `brew`)
2. Open installer (exec: `open` or Peekaboo: `app launch`)
3. Take screenshot to see installer (Peekaboo: `see`)
4. Click through installer (Peekaboo: `click`)
5. Enter password if needed (Peekaboo: `type`)
6. Click Install/Continue buttons (Peekaboo: `click`)
7. Verify installation (exec: `which [binary]`)

**Example: Tailscale Installation (Correct Approach)**
```bash
# 1. Download (already done by brew)
brew install --cask tailscale

# 2. Launch installer
open "/Applications/Tailscale.app"

# 3. See the screen
peekaboo see --annotate --path /tmp/tailscale-setup.png

# 4. Read screenshot, identify "Log In" button (e.g., B1)
# 5. Click it
peekaboo click --on B1

# 6. Wait for browser to open, then monitor status
```

### Pattern 2: System Settings Changes

**Scenario:** Changing system preferences via GUI

**Steps:**
1. Open System Settings (Peekaboo: `app launch "System Settings"`)
2. Navigate to section (Peekaboo: `click`)
3. Change setting (Peekaboo: `click`, `type`)
4. Confirm (Peekaboo: `click`)

**Example: Grant Peekaboo Permissions**
```bash
# 1. Open System Settings
peekaboo app launch "System Settings"

# 2. See the screen
peekaboo see --app "System Settings" --annotate --path /tmp/settings.png

# 3. Click Privacy & Security (identify from screenshot)
peekaboo click --on [element-id] --app "System Settings"

# 4. Click Screen Recording
peekaboo click --on [element-id] --app "System Settings"

# 5. Enable for Terminal
peekaboo click --on [element-id] --app "System Settings"
```

### Pattern 3: Web Automation

**Scenario:** Filling out web forms, configuring web admin panels

**Steps:**
1. Ensure Chrome extension relay is attached
2. Open URL (browser: `open`)
3. Take snapshot (browser: `snapshot`)
4. Click elements (browser: `act` with `click`)
5. Type into fields (browser: `act` with `type`)
6. Submit (browser: `act` with `click` or `press`)

**Example: Tailscale Admin ACLs**
```bash
# Would use browser tool with Chrome extension attached
# Then navigate to admin console, edit ACLs, save
```

### Pattern 4: Monitoring & Screenshots

**Scenario:** Check what's visible on screen, monitor app state

**Steps:**
1. Capture screenshot (Peekaboo: `see` or `image`)
2. Read the image file
3. Identify what's happening
4. Take action based on visual state

**Example: Check if app launched successfully**
```bash
peekaboo app launch "SomeApp"
sleep 2
peekaboo see --app "SomeApp" --annotate --path /tmp/app-state.png
# Read /tmp/app-state.png to verify UI loaded
```

## Gaps Filled

### Previous Gaps
1. ❌ GUI automation → ✅ **Peekaboo skill documented**
2. ❌ Browser control without manual attach → ⚠️ **Still requires manual Chrome extension click** (limitation)
3. ❌ Screen capture → ✅ **Peekaboo `see` and `image` commands**
4. ❌ Application lifecycle → ✅ **Peekaboo `app` commands**
5. ❌ System Preferences automation → ✅ **Peekaboo navigation + clicks**

### Remaining Limitations
- **Browser extension relay** requires manual tab attachment (user must click icon)
- **Peekaboo permissions** require manual System Settings approval (one-time setup)
- **Visual analysis** requires Peekaboo to have vision model configured

## Next Steps to Enable Full Control

1. **Grant Peekaboo permissions:**
   - Open System Settings → Privacy & Security
   - Enable Screen Recording for Terminal
   - Enable Accessibility for Terminal

2. **Test Peekaboo:**
   ```bash
   peekaboo permissions
   peekaboo see --mode screen --annotate --path /tmp/test.png
   peekaboo list apps --json
   ```

3. **Attach Chrome for browser control:**
   - Open Chrome
   - Click OpenClaw Browser Relay extension icon
   - Badge turns "ON"

4. **Document any Mac-specific automations** (add to this file as you discover patterns)

## File Locations

- **This skill:** `/Users/marcusrawlins/.openclaw/workspace/skills/system-control/SKILL.md`
- **Peekaboo skill:** `/opt/homebrew/lib/node_modules/openclaw/skills/peekaboo/SKILL.md`
- **Browser tool:** Built-in OpenClaw tool
- **Exec tool:** Built-in OpenClaw tool

## References

- Peekaboo docs: https://peekaboo.boo
- OpenClaw browser tool: docs/reference/BROWSER-TOOL.md (if exists)
- macOS automation: AppleScript, Automator, defaults, pfctl, launchd
