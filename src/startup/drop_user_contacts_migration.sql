-- Removes the marketplace contact card (phone / e-mail / Facebook per user). The in-app chat replaces it.
-- Run with:  docker compose -f docker-compose.dev.yml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < startup/drop_user_contacts_migration.sql
BEGIN;
DROP TABLE IF EXISTS user_contacts;
COMMIT;
