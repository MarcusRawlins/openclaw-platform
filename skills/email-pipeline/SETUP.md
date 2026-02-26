# Email Pipeline Setup

## Current Accounts

| ID | Email | Provider | Status |
|----|-------|----------|--------|
| marcus-work | marcus@marcusrawlins.com | IMAP (mail.marcusrawlins.com) | Awaiting credentials |
| marcus-personal | marcusvrawlins@gmail.com | Gmail IMAP | Awaiting credentials |

## Adding a New Account

1. Add credentials to `~/.openclaw/.env`:
   ```
   NEW_ACCOUNT_PASSWORD=your-password
   ```

2. Add account to `config.json` accounts array:
   ```json
   {
     "id": "new-account",
     "email": "you@example.com",
     "provider": "imap",
     "credentials_env": "NEW_ACCOUNT_PASSWORD",
     "features": {
       "scoring": true,
       "labels": true,
       "stage_tracking": true,
       "draft_generation": true,
       "escalation": true,
       "auto_archive_spam": true
     },
     "folders": ["INBOX"],
     "poll_interval_minutes": 10
   }
   ```

3. Add himalaya account to `~/Library/Application Support/himalaya/config.toml`:
   ```toml
   [accounts.new-account]
   email = "you@example.com"
   display-name = "Display Name"

   [accounts.new-account.imap]
   host = "imap.provider.com"
   port = 993
   login = "you@example.com"
   passwd.cmd = "grep NEW_ACCOUNT_PASSWORD ~/.openclaw/.env | cut -d= -f2"

   [accounts.new-account.smtp]
   host = "smtp.provider.com"
   port = 587
   login = "you@example.com"
   passwd.cmd = "grep NEW_ACCOUNT_PASSWORD ~/.openclaw/.env | cut -d= -f2"
   ```

4. Test: `himalaya -a you@example.com list --folder INBOX`

No code changes needed. The pipeline auto-discovers all accounts from config.json.

## Credential Setup

### marcus@marcusrawlins.com (cPanel/custom host)
- IMAP: mail.marcusrawlins.com:993
- SMTP: mail.marcusrawlins.com:587
- Env var: `MARCUS_WORK_EMAIL_PASSWORD`

### marcusvrawlins@gmail.com
- IMAP: imap.gmail.com:993
- SMTP: smtp.gmail.com:587
- Requires Gmail App Password (not regular password)
- Generate at: https://myaccount.google.com/apppasswords
- Env var: `MARCUS_GMAIL_PASSWORD`

## Cron

Polling cron job is created but **disabled** until himalaya is configured.
Job ID: `ee2b7485-f26f-4616-8225-d2d35915cb88`
Enable with: `openclaw cron update --id ee2b7485... --enabled true`
