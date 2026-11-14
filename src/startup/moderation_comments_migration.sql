-- Coffer schema update (2026-11-14): Coffer.Manager admins & audit, temporary suspensions, item comments,
-- collection-item and comment reports. Requires marketplace_migration.sql and marketplace_migration_2.sql.
-- Idempotent: safe to run more than once.
-- Run with:  docker compose -f docker-compose.dev.yml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < startup/moderation_comments_migration.sql

BEGIN;

-- The old item_messages table was never used by the app; comments replace it.
DROP TABLE IF EXISTS item_messages CASCADE;

-- Coffer.Manager administrators (audit identity; access comes from COFFER_MANAGER_ADMIN_GITHUB_PROVIDER_IDS).
CREATE TABLE IF NOT EXISTS manager_admins (
    id uuid NOT NULL,
    github_id character varying(40) NOT NULL,
    login character varying(100) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    last_login_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_manager_admins PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_manager_admins_github_id ON manager_admins (github_id);

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id uuid NOT NULL,
    admin_id uuid NOT NULL,
    action character varying(60) NOT NULL,
    target_type character varying(40),
    target_id uuid,
    details jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_admin_audit_log PRIMARY KEY (id),
    CONSTRAINT fk_admin_audit_log_manager_admins_admin_id FOREIGN KEY (admin_id) REFERENCES manager_admins (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_admin_audit_log_created_at ON admin_audit_log (created_at);

-- Temporary suspensions.
CREATE TABLE IF NOT EXISTS user_suspensions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    reason text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    created_by_admin_id uuid NOT NULL,
    source_report_id uuid,
    revoked_at timestamp with time zone,
    revoked_by_admin_id uuid,
    revoke_reason text,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_user_suspensions PRIMARY KEY (id),
    CONSTRAINT ck_user_suspensions_period CHECK (ends_at > starts_at),
    CONSTRAINT fk_user_suspensions_users_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_suspensions_manager_admins_created_by_admin_id FOREIGN KEY (created_by_admin_id) REFERENCES manager_admins (id) ON DELETE RESTRICT,
    CONSTRAINT fk_user_suspensions_manager_admins_revoked_by_admin_id FOREIGN KEY (revoked_by_admin_id) REFERENCES manager_admins (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_user_suspensions_user_id_ends_at ON user_suspensions (user_id, ends_at);

-- Item comments (nested: parent_id = direct parent, root_id = top-level comment of the thread).
CREATE TABLE IF NOT EXISTS item_comments (
    id uuid NOT NULL,
    item_id uuid NOT NULL,
    author_id uuid NOT NULL,
    parent_id uuid,
    root_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    edited_at timestamp with time zone,
    deleted_at timestamp with time zone,
    is_removed boolean NOT NULL DEFAULT false,
    CONSTRAINT pk_item_comments PRIMARY KEY (id),
    CONSTRAINT fk_item_comments_items_item_id FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE CASCADE,
    CONSTRAINT fk_item_comments_users_author_id FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_item_comments_item_comments_parent_id FOREIGN KEY (parent_id) REFERENCES item_comments (id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS ix_item_comments_item_id_parent_id_created_at ON item_comments (item_id, parent_id, created_at);
CREATE INDEX IF NOT EXISTS ix_item_comments_root_id ON item_comments (root_id);
CREATE INDEX IF NOT EXISTS ix_item_comments_author_id ON item_comments (author_id);

CREATE TABLE IF NOT EXISTS item_comment_mentions (
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    CONSTRAINT pk_item_comment_mentions PRIMARY KEY (comment_id, user_id),
    CONSTRAINT fk_item_comment_mentions_item_comments_comment_id FOREIGN KEY (comment_id) REFERENCES item_comments (id) ON DELETE CASCADE,
    CONSTRAINT fk_item_comment_mentions_users_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_item_comment_mentions_user_id ON item_comment_mentions (user_id);

-- Reports on collection items and comments; decisions may suspend the author.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS item_id uuid;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS suspension_id uuid;
CREATE INDEX IF NOT EXISTS ix_reports_target_type_target_id ON reports (target_type, target_id);
ALTER TABLE reports DROP CONSTRAINT IF EXISTS ck_reports_target_type;
ALTER TABLE reports ADD CONSTRAINT ck_reports_target_type CHECK (target_type IN ('listing','message','review','item','comment'));
ALTER TABLE reports DROP CONSTRAINT IF EXISTS ck_reports_decision;
ALTER TABLE reports ADD CONSTRAINT ck_reports_decision CHECK (decision IS NULL OR decision IN ('removed','no_violation','suspended'));
-- resolved_by now points at manager_admins (it used to be a users id from the in-app admin role).
UPDATE reports SET resolved_by = NULL WHERE resolved_by IS NOT NULL AND resolved_by NOT IN (SELECT id FROM manager_admins);

ALTER TABLE moderation_actions ADD COLUMN IF NOT EXISTS item_id uuid;
ALTER TABLE moderation_actions DROP CONSTRAINT IF EXISTS ck_moderation_actions_target_type;
ALTER TABLE moderation_actions ADD CONSTRAINT ck_moderation_actions_target_type CHECK (target_type IN ('listing','message','review','item','comment'));

COMMIT;
