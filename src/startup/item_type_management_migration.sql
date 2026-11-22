-- Item type management from Coffer.Manager: a type is shown in the app only while published (a new type starts hidden;
-- publishing needs its AI models). Hiding deletes nothing. Description translations: language code -> text, like the names.
-- Run with:  docker compose -f docker-compose.dev.yml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < startup/item_type_management_migration.sql
BEGIN;
ALTER TABLE collection_types
    ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS unpublished_at timestamp with time zone NULL,
    ADD COLUMN IF NOT EXISTS description_translations jsonb NOT NULL DEFAULT '{}';
-- Rollout: Cap has both AI models; Stamp has none (and no collections), so it stays hidden until its models are uploaded.
UPDATE collection_types SET published = true WHERE id = 1;
COMMIT;
