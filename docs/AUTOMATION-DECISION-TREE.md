# Automation Decision Tree - Quick Reference

When Marcus needs to do something on the Mac, use this decision tree:

## 🎯 Quick Decision Matrix

| Task | Tool | Example |
|------|------|---------|
| Click through GUI installer | Peekaboo | `peekaboo see → click → type` |
| Run terminal command | exec | `exec: brew install something` |
| Navigate website | browser | `browser: open → snapshot → act` |
| Read/write files | Read/Write/Edit | Direct file operations |
| Change System Settings | Peekaboo | Navigate System Settings UI |
| Install software (CLI) | exec | `brew install`, `npm install` |
| Install software (GUI) | Peekaboo | Click through installer |
| Take screenshot | Peekaboo | `peekaboo see --annotate` |
| Launch/quit app | Peekaboo | `peekaboo app launch/quit` |
| Type into app | Peekaboo | `peekaboo type "text"` |
| Click menu item | Peekaboo | `peekaboo menu click` |
| Firewall config | exec | `sudo pfctl` commands |
| See what's on screen | Peekaboo | `peekaboo see --path /tmp/screen.png` |

## 🚀 Action Flowcharts

### Installing Software with GUI

```
Download installer (exec: curl/brew)
    ↓
Launch installer (exec: open OR Peekaboo: app launch)
    ↓
Screenshot to see UI (Peekaboo: see --annotate)
    ↓
Read screenshot (Read tool on image file)
    ↓
Click buttons (Peekaboo: click --on [element-id])
    ↓
Type if needed (Peekaboo: type "text")
    ↓
Verify install (exec: which [binary])
```

### Changing System Preferences

```
Launch System Settings (Peekaboo: app launch)
    ↓
Screenshot (Peekaboo: see --annotate)
    ↓
Read screenshot to find navigation
    ↓
Click to navigate (Peekaboo: click --on [id])
    ↓
Change setting (Peekaboo: click / type)
    ↓
Confirm (Peekaboo: click)
```

### Web Form Automation

```
Ensure Chrome extension attached (user action required once)
    ↓
Open URL (browser: open)
    ↓
Snapshot page (browser: snapshot)
    ↓
Click / type fields (browser: act with request.kind)
    ↓
Submit (browser: act click or press)
```

## 🎬 Lessons Learned (Anti-Patterns)

### ❌ DON'T: Ask user to click GUI installers
**WRONG:**
```
"The installer is open on your screen, please click through it"
```

**RIGHT:**
```bash
peekaboo see --annotate --path /tmp/installer.png
# Read the image
peekaboo click --on B1  # Install button
peekaboo type "marcus"  # Password if needed
peekaboo click --on B2  # Continue
```

### ❌ DON'T: Give up on GUI tasks
**WRONG:**
```
"I can't interact with GUIs, you'll need to do this manually"
```

**RIGHT:**
```
"Let me use Peekaboo to handle this GUI task"
# Then use Peekaboo workflow
```

### ❌ DON'T: Use exec for GUI-only tasks
**WRONG:**
```bash
# Trying to use CLI for GUI-only settings
defaults write com.apple.systempreferences ...  # May not work for all settings
```

**RIGHT:**
```bash
# Use Peekaboo to navigate System Settings UI
peekaboo app launch "System Settings"
peekaboo see --annotate --path /tmp/settings.png
peekaboo click --on [element-id]
```

## 🔑 Critical Prerequisites

### Peekaboo Permissions (One-time Setup)
1. System Settings → Privacy & Security → Screen Recording → Enable for Terminal
2. System Settings → Privacy & Security → Accessibility → Enable for Terminal

**Test:**
```bash
peekaboo permissions  # Should show both granted
```

### Browser Control (Per-session)
1. Open Chrome
2. Click OpenClaw Browser Relay extension icon
3. Badge turns "ON"

**Test:**
```bash
browser: action=tabs  # Should list tabs, not error
```

## 📋 Pre-Task Checklist

Before starting ANY task, ask:

1. **Is this a GUI task?**
   - Yes → Use Peekaboo (`see` first to understand UI)
   - No → Continue to #2

2. **Is this a web task?**
   - Yes → Use browser tool (check extension is attached)
   - No → Continue to #3

3. **Is this a terminal/file task?**
   - Yes → Use exec/Read/Write
   - No → Reconsider #1

4. **Do I need to SEE what's happening?**
   - Yes → `peekaboo see --annotate` first
   - No → Proceed based on above

## 🎯 Marcus's Expectations

Tyler expects Marcus to:
- ✅ Handle GUI installers without asking for help
- ✅ Navigate System Settings independently
- ✅ See and react to visual state
- ✅ Complete full workflows end-to-end
- ✅ Not give up on GUI tasks
- ✅ Use the right tool for each job

## 🔄 Feedback Loop

When you encounter a new automation pattern:
1. Document it in `/workspace/skills/system-control/SKILL.md`
2. Add to this decision tree if broadly applicable
3. Update MEMORY.md with the lesson learned

---

**Location of this doc:** `/workspace/docs/AUTOMATION-DECISION-TREE.md`

**Last updated:** 2026-02-21 (created after Tailscale installer lesson)
