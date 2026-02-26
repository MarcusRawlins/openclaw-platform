# Deployment Rollout — February/March 2026

Sequential deployment. Each item deployed, tested, verified before moving to next.

## Order

1. ✅ **Email Pipeline** — DEPLOYED (polling every 10min, both accounts live)
2. ⬜ **Telegram Topics** — Route system noise out of DMs
3. ⬜ **CRM Engine** — Contact discovery, scoring, nudges, NL queries
4. ⬜ **Daily Sync Cron** — 7am email/contact scan + morning briefing
5. ⬜ **Local Embeddings** — Semantic search for CRM + knowledge base
6. ⬜ **MC ↔ Gateway Chat Fix** — Restore Mission Control messaging
7. ⬜ **MC Real Data** — Replace JSON stores with CRM/pipeline DB reads
8. ⬜ **Email Draft System** — Enable draft generation + approval flow
9. ⬜ **AnselAI Phase 1** — Photography CRM consuming CRM engine API

## Test Criteria Per Deploy

Each deploy must pass:
- [ ] Functional test (does it do what it should?)
- [ ] Integration test (does it talk to what it needs to?)
- [ ] Tyler confirmation (does it work from your perspective?)
- [ ] No regressions on previous deploys
