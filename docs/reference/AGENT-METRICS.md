# Agent Performance Metrics

## Goal
Each agent should perform at the equivalent of a senior-level professional in their role. These metrics track progress toward that standard.

## Senior-Level Benchmarks

### Brunel Edison (Builder) — Senior Engineer
| Metric | Target | How Measured |
|--------|--------|-------------|
| First-pass review rate | >80% | % of modules Walt passes without revision |
| Bugs per module | <2 | Walt's review findings |
| Spec adherence | >90% | Does output match architecture doc? |
| Build speed | Consistent | Time per module (trending stable or faster) |
| Code reuse | High | Reusable components vs one-off code |

### Scout Pinkerton (Research) — Senior Analyst
| Metric | Target | How Measured |
|--------|--------|-------------|
| Lead accuracy | >90% | % of leads that are real, contactable businesses |
| Lead quality | >75% | % that Ed can draft actionable outreach for |
| Research depth | Actionable | Walt's review of specificity and usefulness |
| Conversion contribution | Tracked | Leads → outreach → responses (long-term funnel) |

### Ed Adler (Outreach) — Senior Sales Dev
| Metric | Target | How Measured |
|--------|--------|-------------|
| Personalization score | >80% | Walt's review: does it feel custom? |
| CTA clarity | 100% | Every email has one clear ask |
| Word count compliance | 100% | Initial emails under 150 words |
| Pipeline contribution | Tracked | Contacts reached → meetings → deals |

### Ada Hypatia (Content) — Senior Content Strategist
| Metric | Target | How Measured |
|--------|--------|-------------|
| First-pass approval rate | >75% | % Walt passes without revision |
| Publication cadence | Weekly | Blog + social produced on schedule |
| Brand consistency | >90% | Walt's brand voice assessment |
| Topic variety | No repeats | Check against previous posts |
| SEO basics | 100% | Title, meta, headers, keywords present |

### Dewey Paul (Data) — Senior Data Engineer
| Metric | Target | How Measured |
|--------|--------|-------------|
| Catalog completeness | >95% | % of drive files indexed in reese-catalog.db |
| Data freshness | <24h | Time since last maintenance run |
| Duplicate detection | Active | Duplicates found and flagged per week |
| Error rate | <5% | Incorrect categorizations found in review |

### Walt Deming (QA) — Senior QA Lead
| Metric | Target | How Measured |
|--------|--------|-------------|
| Review turnaround | <2h | Time from needs_review → reviewed |
| Catch rate | High | Issues caught that would've been problems |
| False positive rate | <10% | Marcus calibration: things flagged that aren't issues |
| Lesson effectiveness | Tracked | Are agents repeating documented mistakes? |

## Team-Wide Metrics
| Metric | Description |
|--------|-------------|
| Tasks completed/week | Per agent and total |
| First-pass rate | % passing Walt without revision (team average) |
| Revision rate | % sent back for fixes |
| Avg time per status | How long tasks sit in queued/active/review/done |
| Quality trend | Are review scores improving month over month? |
| Pipeline funnel | Scout leads → Ed outreach → responses → meetings → deals |

## Tracking
- Metrics derived from tasks.json (status changes, timestamps) and review files
- Stored as append-only log: `/Volumes/reeseai-memory/agents/metrics/YYYY-MM.json`
- Displayed in Mission Control Metrics view (MC-6)
