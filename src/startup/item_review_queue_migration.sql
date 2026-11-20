-- Waiting-for-review list: every cap the AI finds on an uploaded photo waits here until its owner adds it or deletes it.
-- Also: attributes get a "required" flag (the primary attribute is always required).
-- Run with:  docker compose -f docker-compose.dev.yml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < startup/item_review_queue_migration.sql
BEGIN;
CREATE TABLE IF NOT EXISTS pending_items (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    collection_id uuid NOT NULL,
    quantity integer NOT NULL,
    image text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_pending_items PRIMARY KEY (id),
    CONSTRAINT fk_pending_items_users_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_pending_items_collections_collection_id FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_pending_items_collection_id_created_at ON pending_items (collection_id, created_at);
CREATE INDEX IF NOT EXISTS ix_pending_items_user_id ON pending_items (user_id);
ALTER TABLE attributes ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT false;
UPDATE attributes SET required = true WHERE "primary" = true;
COMMIT;
