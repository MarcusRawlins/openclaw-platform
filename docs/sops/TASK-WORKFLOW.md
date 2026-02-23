# Task Workflow SOP

**Version:** 1.0  
**Last Updated:** 2026-02-22  
**Effective Date:** 2026-02-23

---

## Purpose

Define the complete workflow for task creation, specification, implementation, review, and completion. Ensure clear separation of concerns between architecture (Marcus), implementation (Brunel), and quality assurance (Walt).

---

## Roles & Responsibilities

### Marcus (Chief of Staff)
- **Product vision** — Understands Tyler's goals and priorities
- **Architecture** — Writes detailed implementation specs
- **Coordination** — Assigns tasks, answers questions, resolves blockers
- **Final approval** — Ships completed work to production

### Brunel (Builder)
- **Implementation only** — Builds exactly to Marcus's spec
- **Clarifying questions** — Asks Marcus when spec is unclear
- **Quality** — Clean code, proper types, no shortcuts
- **Submission** — Moves to needs_review when complete

### Walt (Quality Reviewer)
- **Code review** — Reviews implementations against spec
- **Testing** — Verifies all acceptance criteria met
- **Feedback** — Specific, actionable revision requests
- **Documentation** — Saves full reviews, updates lessons

---

## The Workflow

### Phase 1: Specification (Marcus)

**Input:** Tyler's request or identified need

**Process:**
1. Marcus elevates to Sonnet for complex architecture
2. Writes detailed implementation spec in `/workspace/specs/`
3. Spec includes:
   - Objective (what and why)
   - Data model changes (exact TypeScript interfaces)
   - API contracts (endpoints, request/response)
   - Component structure (file locations, props)
   - Implementation steps (numbered, sequential)
   - Testing checklist
   - Acceptance criteria (how to know it's done)
4. Creates task in tasks.json with:
   - Title, description
   - `assignedTo: "brunel"`
   - `status: "queued"`
   - `priority: high|medium|low`
   - `specPath: "/workspace/specs/task-name.md"`
5. Notifies Brunel (via sessions_send or cron pickup)

**Output:** Complete implementation spec + task assigned

**Time:** 15-30 minutes for complex features, 5-10 for simple

---

### Phase 2: Implementation (Brunel)

**Input:** Task with spec path

**Process:**
1. Read spec thoroughly from start to finish
2. If **anything is unclear**, ask Marcus via sessions_send:
   ```
   sessions_send(
     sessionKey: "agent:main:main",
     message: "Task X spec question: [specific question]"
   )
   ```
3. Wait for Marcus's response before proceeding
4. Implement **exactly to spec**:
   - Follow file structure specified
   - Use exact TypeScript interfaces
   - Implement all features listed
   - Complete all acceptance criteria
5. Test locally:
   - `bun run dev` (Mission Control)
   - Verify all features work
   - No TypeScript errors
   - No console errors
6. Commit with conventional format:
   ```
   feat: [module] brief description
   
   - Implemented X component
   - Added Y API endpoint
   - Integrated Z feature
   
   Spec: /workspace/specs/task-name.md
   ```
7. Update task:
   - `status: "needs_review"`
   - `updatedAt: [timestamp]`
8. Notify Walt (task status triggers review queue)

**Output:** Working implementation committed to git

**Time:** 1-4 hours depending on complexity

**Rules:**
- ❌ Do NOT interpret or freelance
- ❌ Do NOT add features not in spec
- ❌ Do NOT submit planning notes as implementation
- ✅ Ask questions if spec is unclear
- ✅ Build exactly what's specified
- ✅ Test before submitting

---

### Phase 3: Review (Walt)

**Input:** Task in needs_review status

**Process:**
1. Read original spec from `specPath`
2. Review implementation against spec:
   - Does code exist? (not just planning notes)
   - Does it match the spec?
   - Are all acceptance criteria met?
   - Code quality (clean, type-safe, secure)
   - Testing (does it work?)
3. Grade the work:
   - **PASS** — Perfect, ship it
   - **PASS_WITH_NOTES** — Good, minor improvements suggested
   - **NEEDS_REVISION** — Missing features, bugs, or quality issues
4. Write review:
   - What's good (strengths)
   - What's missing or wrong (specific)
   - What to fix (actionable steps)
5. Save full review to `/Volumes/reeseai-memory/agents/reviews/YYYY-MM-DD-task-name.md`
6. Update task:
   - `reviewGrade: pass|pass_with_notes|needs_revision`
   - `reviewNotes: [brief summary]`
   - If PASS: `status: "done"`, `completedAt: [timestamp]`
   - If NEEDS_REVISION: `status: "active"` (back to Brunel)
7. If patterns emerge, update `/agents/brunel/lessons.md`

**Output:** Graded task with feedback

**Time:** 10-20 minutes per task

**Rules:**
- ❌ Do NOT pass planning-only submissions
- ❌ Do NOT accept partial implementations
- ✅ Be specific in feedback
- ✅ Verify code actually exists and works
- ✅ Compare against original spec

---

### Phase 4: Revision (Brunel, if needed)

**Input:** Task with `reviewGrade: needs_revision`

**Process:**
1. Read Walt's review carefully
2. Address **every point** in the feedback
3. Re-test thoroughly
4. Commit fixes:
   ```
   fix: [module] address Walt's review feedback
   
   - Fixed X issue
   - Added missing Y feature
   - Improved Z per review notes
   
   Review: /Volumes/reeseai-memory/agents/reviews/[review-file].md
   ```
5. Update task:
   - `status: "needs_review"` (back to Walt)
   - `updatedAt: [timestamp]`

**Output:** Revised implementation

**Repeat:** Until Walt grades PASS or PASS_WITH_NOTES

---

### Phase 5: Completion (Marcus)

**Input:** Task with `reviewGrade: pass` or `pass_with_notes`

**Process:**
1. Review Walt's assessment
2. Spot-check implementation (random sampling)
3. If satisfied:
   - Merge to main (if needed)
   - Deploy to production
   - Notify Tyler of completion
4. Archive completed task to `/Volumes/reeseai-memory/agents/tasks/YYYY-MM/`

**Output:** Shipped feature

---

## Communication Protocols

### Brunel → Marcus

**When:** Spec is unclear, blocker encountered, question about approach

**How:** 
```typescript
sessions_send(
  sessionKey: "agent:main:main",
  message: "Task [ID]: [specific question]"
)
```

**Response time:** Marcus responds within 1 hour during active hours (7am-11pm)

---

### Walt → Marcus

**When:** Pattern identified, lesson learned, process improvement

**How:**
- Update `/agents/walt/lessons.md` directly
- If urgent: sessions_send to Marcus

---

### Marcus → Tyler

**When:** Task complete, blocker needs Tyler's input, major decision

**How:** 
- Via Telegram (current session)
- Include context, recommendation, ask

---

## Status Definitions

| Status | Meaning | Who Sets |
|--------|---------|----------|
| `queued` | Spec written, ready to implement | Marcus |
| `active` | Implementation in progress | Brunel |
| `needs_review` | Implementation complete, code exists | Brunel |
| `done` | Reviewed and passed | Walt |

**Critical:** `needs_review` means "working code exists." NOT "I have a plan."

---

## Quality Gates

### Before `needs_review`:
- [ ] All spec requirements implemented
- [ ] Code builds without errors
- [ ] Features work locally
- [ ] All acceptance criteria met
- [ ] Changes committed to git

### Before `done`:
- [ ] Walt reviewed against spec
- [ ] All revision feedback addressed
- [ ] Grade is PASS or PASS_WITH_NOTES
- [ ] Full review saved to drive

---

## Metrics Tracked

For every completed task:
- **Time spent** (createdAt → completedAt)
- **Actual cost** (token usage × model pricing)
- **Model breakdown** (which models used how many tokens)
- **Revision count** (how many NEEDS_REVISION cycles)
- **Review grade** (PASS, PASS_WITH_NOTES)

See: `/workspace/specs/task-cost-tracking.md`

---

## Common Pitfalls

### ❌ Brunel submitting plans instead of code
**Fix:** Only move to needs_review when implementation exists

### ❌ Spec too vague
**Fix:** Marcus writes more detail, Brunel asks questions

### ❌ Walt reviewing plans instead of code
**Fix:** Walt checks "does code exist?" first

### ❌ Revision loops (3+ cycles)
**Fix:** Marcus rewrites spec, Brunel asks more questions upfront

---

## Success Criteria

**Good workflow:**
- 1 review cycle (QUEUED → ACTIVE → NEEDS_REVIEW → DONE)
- Clear spec, no ambiguity
- Implementation matches spec exactly
- PASS or PASS_WITH_NOTES on first review

**Acceptable workflow:**
- 2 review cycles (minor fixes)
- Spec needed minor clarification
- PASS on second review

**Bad workflow:**
- 3+ review cycles
- Implementation diverges from spec
- Planning-only submissions

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-22 | 1.0 | Initial SOP: Marcus specs, Brunel builds, Walt reviews |

---

## References

- Task tracking: `/workspace/mission_control/data/tasks.json`
- Specs: `/workspace/specs/`
- Reviews: `/Volumes/reeseai-memory/agents/reviews/`
- Lessons: `/agents/[id]/lessons.md`
- Cost tracking spec: `/workspace/specs/task-cost-tracking.md`
