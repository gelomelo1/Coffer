-- Translatable reference names: other languages of collection type names, attribute names and item option labels.
-- English stays in name / option_labels (used by queries and the seed); JSON holds e.g. {"hu": "Kupak"}.
-- The API serializes the Accept-Language translation, falling back to English.
-- Run with:  docker compose -f docker-compose.dev.yml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < startup/i18n_reference_names_migration.sql
BEGIN;
ALTER TABLE collection_types ADD COLUMN IF NOT EXISTS name_translations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE attributes ADD COLUMN IF NOT EXISTS name_translations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE item_options ADD COLUMN IF NOT EXISTS option_labels_translations jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
