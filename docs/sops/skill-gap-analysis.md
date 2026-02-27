# Daily Skill Gap Analysis

## Process
During the nightly learning review (1am cron), Marcus should:

1. Review tasks completed in last 24h
2. Identify patterns where agents struggled or failed
3. Check if a skill would have helped
4. If yes, create the skill or add to backlog

## Common Gaps to Watch For
- Repeated manual steps that could be automated
- Agent errors from not knowing how to use a tool
- Tasks that require external API calls without a skill
- Content tasks that don't follow brand guidelines (need voice skills)

## Auto-Create Criteria
Create a skill when:
- Same manual process happens 3+ times
- Agent fails the same way twice
- Tyler requests something that should be repeatable

## Skill Template
Use the skill-creator skill to build new skills:
- Location: /workspace/skills/[skill-name]/SKILL.md
- Must include: when to use, step-by-step, examples
- Register in available_skills if needed
