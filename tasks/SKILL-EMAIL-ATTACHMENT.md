# Task: Build Email + File Attachment Skill

**Status:** TODO  
**Priority:** High  
**Owner:** Marcus  
**Created:** 2026-02-24

---

## Objective

Create a reusable skill for sending emails and attaching files programmatically. This skill was discovered during the Brand Voice + Skills work (2026-02-24) and should be built out properly.

## What We Learned

- macOS Mail app can be controlled via osascript (AppleScript)
- Can compose, set recipients, add content, and send
- Can also handle file attachments
- This is a gap in Marcus's toolkit — we need this as a proper, documented skill

## Use Cases

1. **Email deliverables** — Send project summaries, documentation
2. **Attach files** — Include PDFs, docs, images with emails
3. **Batch communications** — Multiple recipients, templated content
4. **Follow-ups** — Auto-send reminders with attachments

## How We Did It (Reference)

Used osascript to control Mail.app:

```applescript
tell application "Mail"
    set newMessage to make new outgoing message with properties {subject:"...", content:"..."}
    tell newMessage
        make new to recipient at end of to recipients with properties {address:"..."}
        send
    end tell
end tell
```

## Next Steps

1. Create `/opt/homebrew/lib/node_modules/openclaw/skills/mail-send/SKILL.md`
2. Document AppleScript patterns for:
   - Composing emails
   - Adding recipients (to, cc, bcc)
   - Attaching files
   - Setting subject + body
   - Sending
3. Error handling (email validation, file existence checks)
4. Template examples (simple, with attachments, batch mode)
5. Limitations (macOS only, requires Mail.app)

## Resources

- Working example: Session 2026-02-24, osascript block that sent Brand Voice email
- AppleScript Mail documentation: https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/reference/ASLR_mail.html

---

**Priority:** Build this skill soon. It's a gap that should be filled.
