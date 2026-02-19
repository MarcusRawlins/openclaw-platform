# SOP: Database Standards

> SQLite conventions for all Reese Operations databases.

## Defaults

Every database uses:
- **SQLite** (no Postgres, no MySQL, no cloud DBs)
- **WAL mode** (`PRAGMA journal_mode=WAL`)
- **Foreign keys on** (`PRAGMA foreign_keys=ON`)
- **Location:** Within the project directory or `data/` subdirectory

## Naming

- Database files: `snake_case.db`
- Tables: `snake_case`, plural (`contacts`, `interactions`, `sessions`)
- Columns: `snake_case` (`created_at`, `updated_at`, `relationship_score`)
- Primary keys: `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- Foreign keys: `<table_singular>_id` (e.g., `contact_id`)
- Timestamps: ISO 8601 strings or Unix epoch milliseconds (be consistent per DB)

## Schema Management

- Keep schema creation in a dedicated file (`schema.js` or `migrate.js`)
- Use `CREATE TABLE IF NOT EXISTS` for idempotency
- Add columns with `ALTER TABLE ... ADD COLUMN` wrapped in try/catch (or check if exists first)
- Never drop tables in production migrations

## Backups

- Primary: `/Volumes/reeseai-memory`
- Secondary: `/Volumes/BACKUP` (nightly)
- Include a `manifest.json` listing all databases and their paths
- Keep last 7 backups minimum

## Vector Embeddings

When a database needs semantic search:
- Standard dimensions: 768 (Google gemini-embedding-001) or 1536 (OpenAI text-embedding-3-small)
- Store embeddings as JSON arrays in TEXT columns
- Build a cosine similarity function for search
- Batch embedding generation (8-10 at a time) to respect rate limits

## Anti-Patterns

- ❌ Using a cloud database when SQLite works
- ❌ Storing secrets in the database
- ❌ Databases outside the workspace (hard to back up)
- ❌ Multiple databases for what should be one (unless genuinely separate domains)
- ❌ Raw SQL strings scattered through code (centralize in a db module)
