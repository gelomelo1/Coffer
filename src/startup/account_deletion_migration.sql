-- Account deletion: users, collections, items and listings are never hard-deleted while other users' data may point
-- at them. Deleting wipes the content and sets deleted_at; the row stays as a placeholder ("tombstone").
-- Run with:  docker compose -f docker-compose.dev.yml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < startup/account_deletion_migration.sql
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE items ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
COMMIT;
