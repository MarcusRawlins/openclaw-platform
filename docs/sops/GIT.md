# Git Workflow SOP

## Repository Structure

The workspace uses a **mono-repo with submodules** structure:

```
/Users/marcusrawlins/.openclaw/workspace/  (main repo)
├── mission_control/                        (git submodule)
├── anselai/                                (part of main repo)
├── docs/
├── memory/
└── ...
```

## Branch Strategy

- **Main development branch:** `phase1/clean-foundation`
- Feature branches: `feature/[module-name]` (optional for experimental work)
- Production-ready work stays on `phase1/clean-foundation` until we're ready to merge to `main`

## Commit-After-Each-Module Workflow

### For Mission Control modules (MC-1, MC-2, etc.):

1. **Work in the mission_control directory:**
   ```bash
   cd /Users/marcusrawlins/.openclaw/workspace/mission_control
   ```

2. **After completing a module, commit:**
   ```bash
   git add -A
   git commit -m "feat(module-name): brief description
   
   - Bullet point of what changed
   - Another change
   - More details
   
   Completed task: [task-id]"
   ```

3. **Update the parent workspace to track the new submodule state:**
   ```bash
   cd /Users/marcusrawlins/.openclaw/workspace
   git add mission_control
   git commit -m "chore: update mission_control submodule to [module-name]"
   ```

### For AnselAI modules (A1A, A1B, A1C, etc.):

1. **Work in the anselai directory:**
   ```bash
   cd /Users/marcusrawlins/.openclaw/workspace/anselai
   ```

2. **After completing a module, commit at workspace level:**
   ```bash
   cd /Users/marcusrawlins/.openclaw/workspace
   git add anselai/
   git commit -m "feat(anselai-module): brief description
   
   - Details of changes
   - API endpoints added
   - Components created
   
   Completed task: [task-id]"
   ```

## Commit Message Format

Use **conventional commits** for consistency:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `chore`: Maintenance (dependencies, configs)
- `docs`: Documentation only
- `refactor`: Code restructure without behavior change
- `test`: Adding or updating tests

**Scope examples:**
- `blueprint`, `tasks`, `crm`, `contacts`, `pipeline`, `calendar`

**Footer:**
- `Completed task: [task-id]` — Always include when closing a task
- `BREAKING CHANGE:` — For breaking API changes

## Examples

### Mission Control module completion:
```bash
cd mission_control
git add -A
git commit -m "feat(tasks): add task management UI (MC-2)

- Task list view with filters
- Create/edit task drawer
- Status badges and priority indicators
- Assignment dropdown
- Real-time updates via API polling

Completed task: mc-2-task-ui"

cd ..
git add mission_control
git commit -m "chore: update mission_control to MC-2 completion"
```

### AnselAI module completion:
```bash
cd /Users/marcusrawlins/.openclaw/workspace
git add anselai/
git commit -m "feat(contacts): add CRUD functionality (Module 1C)

- Contact list page with search/filter
- Create contact modal
- Edit/delete actions
- Prisma schema and API routes
- Form validation

Completed task: a1c-contacts-crud"
```

## Daily Routine

At the end of each work session, commit any in-progress work:

```bash
cd /Users/marcusrawlins/.openclaw/workspace
git add -A
git commit -m "wip: [description of current state]"
```

This ensures work is never lost and provides rollback points.

## Checking Status

**Mission Control:**
```bash
cd mission_control && git status
```

**Workspace (including AnselAI):**
```bash
cd /Users/marcusrawlins/.openclaw/workspace && git status
```

## Viewing History

```bash
git log --oneline --graph --decorate -10
```

## Best Practices

1. **Commit after each completed module** (not mid-module unless it's a logical checkpoint)
2. **Keep commits focused** — one module per commit when possible
3. **Write clear commit messages** — future you will thank you
4. **Never commit secrets** — .env files are gitignored
5. **Test before committing** — make sure the build works
6. **Update task status via API** after committing

## Troubleshooting

### Submodule out of sync:
```bash
cd mission_control
git pull origin phase1/clean-foundation
cd ..
git add mission_control
git commit -m "chore: sync mission_control submodule"
```

### Accidentally committed to wrong repo:
```bash
# Undo last commit (keeps changes)
git reset --soft HEAD~1

# Commit in the correct location
```

### Check what's staged:
```bash
git diff --cached
```
