-- Private activity log: every user action as an event ("rated Heineken 5★", "shipped the deal").
-- Targets are ids only (no foreign keys): an entry outlives its target and then reads "No longer available".
-- Run with:  docker compose -f docker-compose.dev.yml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < startup/activity_log_migration.sql
BEGIN;
CREATE TABLE IF NOT EXISTS activity_events (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind character varying(60) NOT NULL,
    category character varying(20) NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    item_id uuid NULL,
    collection_id uuid NULL,
    comment_id uuid NULL,
    listing_id uuid NULL,
    conversation_id uuid NULL,
    deal_id uuid NULL,
    review_id uuid NULL,
    report_id uuid NULL,
    other_user_id uuid NULL,
    details jsonb NOT NULL DEFAULT '{}',
    backfilled boolean NOT NULL DEFAULT false,
    CONSTRAINT pk_activity_events PRIMARY KEY (id),
    CONSTRAINT fk_activity_events_users_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_activity_events_user_id_category_occurred_at ON activity_events (user_id, category, occurred_at);
CREATE INDEX IF NOT EXISTS ix_activity_events_user_id_occurred_at ON activity_events (user_id, occurred_at);
COMMIT;
