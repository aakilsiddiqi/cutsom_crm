# Database Migration Workflow

## Principles

1. **`schema.sql` is the single source of truth.** It must always reflect the complete
   target state of the production database.

2. **Every schema change is a migration file.** Never edit the database via the
   Supabase Dashboard SQL Editor. Dashboard use only for data exploration.

3. **Migrations go forward only.** Never alter a migration file after it's been
   applied to production. Create a new migration.

## File Structure

```
Backend/
  schema.sql              # Complete target schema (for fresh DB creation)
  MIGRATIONS.md           # This document
  migrations/
    001_initial_schema.sql  # Not used here (schema.sql IS the initial)
    002_add_user_email_lookup.sql
    003_fix_view_security.sql
    004_add_performance_indexes.sql
    005_<next_change>.sql
```

## How to Make a Schema Change

### Step 1: Create a migration file

```
Backend/migrations/005_descriptive_name.sql
```

Use `CREATE OR REPLACE`, `IF NOT EXISTS`, `IF EXISTS` so the migration is
idempotent (safe to re-run).

Wrap in a transaction if the migration has multiple steps that must all succeed
or all fail:

```sql
BEGIN;
-- your changes here
COMMIT;
```

### Step 2: Update `schema.sql`

Edit `schema.sql` to reflect the change so it remains the complete source of
truth for fresh database creation.

### Step 3: Apply migration to production

Open the Supabase Dashboard SQL Editor and run the migration file contents.
Or use the Supabase CLI if configured:

```bash
supabase db push
```

### Step 4: Commit

Commit both the new migration file and the updated `schema.sql`.

## Applying to a Fresh Database

1. Run `schema.sql` in full via the Supabase SQL Editor.
2. Run `migrations/` files in order (though a fresh DB won't need them
   since `schema.sql` already includes everything).

## Verifying the Migration

After applying, check that the expected objects exist:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check views
SELECT table_name FROM information_schema.views WHERE table_schema = 'public';

-- Check functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

-- Check policies
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- Check triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers WHERE trigger_schema = 'public';

-- Check indexes
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN ('profiles', 'job_sheets', 'job_updates');
```

## Troubleshooting

| Symptom | Likely Cause |
|---------|-------------|
| `relation already exists` | Table already created by previous migration. Use `CREATE TABLE IF NOT EXISTS`. |
| `policy already exists` | Policy already exists. Migration should use `DROP POLICY IF EXISTS` + `CREATE POLICY` for changed policies. |
| `cannot drop view` | View has dependent objects. Drop dependents first or use `DROP VIEW IF EXISTS ... CASCADE`. |
| `permission denied` | Missing `GRANT` or running as wrong user. Use service role key in Supabase client. |

## Migration History

| # | File | Date | Description |
|---|------|------|-------------|
| 1 | (baseline) | — | Initial schema in `schema.sql` |
| 2 | `001_add_user_email_lookup.sql` | — | `get_user_email_by_username` RPC (was created in Dashboard) |
| 3 | `002_fix_view_security.sql` | — | Added `security_invoker` to view + GRANTs |
| 4 | `003_add_performance_indexes.sql` | — | Performance indexes for common queries |
