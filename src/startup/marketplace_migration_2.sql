-- Coffer marketplace migration 2 (2026-11-14): reports & neutral disputes.
-- Requires marketplace_migration.sql to have been applied. Generated from the EF model + hand-written ALTERs.
-- Run with:  docker compose -f docker-compose.dev.yml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < startup/marketplace_migration_2.sql

BEGIN;

-- Moderator-arbitrated cases are replaced by rule-based reports.
DROP TABLE IF EXISTS moderation_cases CASCADE;
DROP TABLE IF EXISTS moderation_actions, reports CASCADE;

CREATE TABLE moderation_actions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    target_type character varying(40) NOT NULL,
    target_id uuid NOT NULL,
    listing_id uuid,
    conversation_id uuid,
    rule character varying(40) NOT NULL,
    statement text NOT NULL,
    content_excerpt text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    seen_at timestamp with time zone,
    CONSTRAINT pk_moderation_actions PRIMARY KEY (id),
    CONSTRAINT fk_moderation_actions_users_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE TABLE reports (
    id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    target_type character varying(40) NOT NULL,
    target_id uuid NOT NULL,
    target_owner_id uuid NOT NULL,
    listing_id uuid,
    conversation_id uuid,
    target_summary text NOT NULL,
    rule character varying(40) NOT NULL,
    reason text NOT NULL,
    snapshot jsonb NOT NULL,
    status character varying(40) NOT NULL,
    decision character varying(40),
    statement text,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_reports PRIMARY KEY (id),
    CONSTRAINT fk_reports_users_reporter_id FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_moderation_actions_user_id_created_at ON moderation_actions (user_id, created_at);
CREATE INDEX ix_reports_reporter_id_target_type_target_id ON reports (reporter_id, target_type, target_id);
CREATE INDEX ix_reports_status_created_at ON reports (status, created_at);
CREATE INDEX ix_reports_target_owner_id ON reports (target_owner_id);

ALTER TABLE reports ADD CONSTRAINT ck_reports_target_type CHECK (target_type IN ('listing','message','review'));
ALTER TABLE reports ADD CONSTRAINT ck_reports_rule CHECK (rule IN ('illegal_item','counterfeit','scam_or_fraud','harassment','personal_data','spam','fake_review','off_topic','other'));
ALTER TABLE reports ADD CONSTRAINT ck_reports_status CHECK (status IN ('open','resolved'));
ALTER TABLE reports ADD CONSTRAINT ck_reports_decision CHECK (decision IS NULL OR decision IN ('removed','no_violation'));
ALTER TABLE moderation_actions ADD CONSTRAINT ck_moderation_actions_target_type CHECK (target_type IN ('listing','message','review'));
ALTER TABLE moderation_actions ADD CONSTRAINT ck_moderation_actions_rule CHECK (rule IN ('illegal_item','counterfeit','scam_or_fraud','harassment','personal_data','spam','fake_review','off_topic','other'));

-- Terms acceptance.
ALTER TABLE users ADD COLUMN IF NOT EXISTS market_terms_version text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS market_terms_accepted_at timestamp with time zone;

-- Private-seller declaration + moderation removal status.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS private_seller_declared boolean NOT NULL DEFAULT false;
UPDATE listings SET private_seller_declared = true WHERE kind IN ('sell','exchange');
ALTER TABLE listings DROP CONSTRAINT IF EXISTS ck_listings_status;
ALTER TABLE listings ADD CONSTRAINT ck_listings_status CHECK (status IN ('active','pending_pickup','pending_shipment','sold','archived','removed'));

-- Removed chat messages.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_removed boolean NOT NULL DEFAULT false;

-- Neutral disputes: disputed is terminal and no longer holds the listing.
ALTER TABLE deals ADD COLUMN IF NOT EXISTS dispute_reason text;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS disputed_at timestamp with time zone;
DROP INDEX IF EXISTS ux_deals_one_open_per_listing;
CREATE UNIQUE INDEX ux_deals_one_open_per_listing ON deals (listing_id) WHERE status IN ('proposed','awaiting_handoff','awaiting_shipment','shipped');
ALTER TABLE deals DROP CONSTRAINT IF EXISTS ck_deals_completion_reason;
ALTER TABLE deals ADD CONSTRAINT ck_deals_completion_reason CHECK (completion_reason IS NULL OR completion_reason IN ('handoff_verified','receipt_confirmed','auto_completed','moderator'));

COMMIT;
