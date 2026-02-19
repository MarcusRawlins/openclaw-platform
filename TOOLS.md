# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Email
- Marcus email: marcus@marcusrawlins.com
- Access: macOS Mail app
- Credentials: stored in `~/.openclaw/.env` (MARCUS_EMAIL, MARCUS_PASSWORD)

## Storage Drives
- **Primary memory:** /Volumes/reeseai-memory (2TB SSD)
  - /OLD/ contains previous ReeseAI system (agents, photography, r3-studios, datasets)
- **Backup:** /Volumes/BACKUP
  - /reeseai-backup/ subdirectory

## R3 Studios / ZipGolf
- ZipGolf (Birdieway) source: /Volumes/reeseai-memory/OLD/photography/r3-studios/ZipGolf/
- Multi-tenant SaaS for golf courses (digital passes, gift cards, lesson bookings)
- Stack: Next.js 16, Bun, PostgreSQL + Prisma 7, Stripe Connect, Tailwind 4

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
