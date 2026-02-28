# Verification Requirement for All Tasks

## Rule
No task gets marked "needs_review" without proof it works in production.

## What Counts as Proof

### Web Apps / Sites
- curl showing HTTP 200
- Verify CSS/JS assets load (not just HTML)
- Screenshot or snapshot of rendered page

### API Endpoints
- curl with actual response body
- Test with sample data

### CLI Tools / Scripts
- Run the command and show output
- Test with real data, not just "script exists"

### Database / Data Tasks
- Query showing row counts
- Sample query with results

### Build Tasks
- `npm run build` output showing success
- No errors in build log

## How to Verify

Before updating task status to needs_review, the agent MUST include in their completion notes:
1. What they tested
2. The actual output/result
3. Any known issues

## Walt's Review Criteria (Updated)
Walt should check:
1. Does the code exist? (git log)
2. Does it build? (npm run build)
3. Does it run? (curl/test)
4. Does it look right? (snapshot if UI)

If the agent didn't provide verification proof, send it back as needs_revision with "missing verification" as the reason.
