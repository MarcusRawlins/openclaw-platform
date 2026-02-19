# SOP: Git Workflow

> Version control standards for the Reese Operations workspace.

## Repository

- **GitHub account:** MarcusRawlins
- **Workspace repo:** TBD (needs setup)
- **Branch strategy:** Feature branches off `main`

## Branch Naming

```
feature/<description>       # New features
fix/<description>           # Bug fixes
refactor/<description>      # Code restructuring
docs/<description>          # Documentation only
```

Examples: `feature/photography-pipeline`, `fix/websocket-reconnect`, `docs/architecture`

## Commit Messages

Format: `<type>: <description>`

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `style`, `test`

```
feat: add photography pipeline panel to Mission Control
fix: resolve WebSocket reconnect on gateway restart
docs: create architecture and SOP documents
chore: strip demo data from mission_control
```

## Rules

1. **Never push to main directly.** Feature branches only.
2. **Brunel always uses feature branches.** Marcus reviews before merge.
3. **No secrets in commits.** Use `.env` files, add to `.gitignore`.
4. **No binary blobs.** Databases, images, and large files stay out of git.
5. **Commit frequently.** Small, focused commits over large dumps.

## .gitignore Essentials

```
.env
*.db
*.db-wal
*.db-shm
node_modules/
.next/
*.log
```
