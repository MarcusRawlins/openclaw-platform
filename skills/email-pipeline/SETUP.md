# Email Pipeline Setup

## 1. Add Email Credentials to ~/.openclaw/.env

```bash
# Photography (IMAP)
PHOTOGRAPHY_EMAIL_HOST=imap.yourdomain.com
PHOTOGRAPHY_EMAIL_PASSWORD=your-app-password

# Rehive (IMAP)
REHIVE_EMAIL_HOST=imap.yourdomain.com
REHIVE_EMAIL_PASSWORD=your-app-password

# Personal Gmail (OAuth or App Password)
GMAIL_OAUTH_TOKEN=your-token
# OR for app password:
GMAIL_EMAIL_PASSWORD=your-app-password
```

## 2. Configure Himalaya

After credentials are in .env, run:
```bash
himalaya account configure
```

Or create the config manually at:
`~/Library/Application Support/himalaya/config.toml`

Template below (update host/port for your providers):

```toml
[accounts.photography]
email = "hello@bythereeses.com"
display-name = "By The Reeses"
default = true

[accounts.photography.imap]
host = "imap.yourdomain.com"
port = 993
login = "hello@bythereeses.com"
passwd.cmd = "grep PHOTOGRAPHY_EMAIL_PASSWORD ~/.openclaw/.env | cut -d= -f2"

[accounts.photography.smtp]
host = "smtp.yourdomain.com"
port = 587
login = "hello@bythereeses.com"
passwd.cmd = "grep PHOTOGRAPHY_EMAIL_PASSWORD ~/.openclaw/.env | cut -d= -f2"

[accounts.rehive]
email = "hello@getrehive.com"
display-name = "R3 Studios"

[accounts.rehive.imap]
host = "imap.yourdomain.com"
port = 993
login = "hello@getrehive.com"
passwd.cmd = "grep REHIVE_EMAIL_PASSWORD ~/.openclaw/.env | cut -d= -f2"

[accounts.rehive.smtp]
host = "smtp.yourdomain.com"
port = 587
login = "hello@getrehive.com"
passwd.cmd = "grep REHIVE_EMAIL_PASSWORD ~/.openclaw/.env | cut -d= -f2"

[accounts.personal]
email = "jtyler.reese@gmail.com"
display-name = "Tyler Reese"

[accounts.personal.imap]
host = "imap.gmail.com"
port = 993
login = "jtyler.reese@gmail.com"
passwd.cmd = "grep GMAIL_EMAIL_PASSWORD ~/.openclaw/.env | cut -d= -f2"

[accounts.personal.smtp]
host = "smtp.gmail.com"
port = 587
login = "jtyler.reese@gmail.com"
passwd.cmd = "grep GMAIL_EMAIL_PASSWORD ~/.openclaw/.env | cut -d= -f2"
```

## 3. Test

```bash
himalaya -a hello@bythereeses.com list --folder INBOX
```

## 4. Start Polling

Cron job is pre-configured. Once himalaya works, the pipeline will poll automatically every 10 minutes.
