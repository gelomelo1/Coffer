-- Shape What's Next (contribution): the switch, voting and photo phases, votes, classification forms and photos.
-- Photos live in COFFER_ROOT_PATH/data/contributions/{phaseId}/…; example galleries in …/contributions/examples/.
-- Run with:  docker compose -f docker-compose.dev.yml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < startup/contribution_migration.sql
BEGIN;
CREATE TABLE IF NOT EXISTS contribution_settings (
    id integer NOT NULL,
    enabled boolean NOT NULL DEFAULT false,
    reason character varying(32) NULL,
    active_phase_id uuid NULL,
    updated_at timestamp with time zone NOT NULL,
    updated_by uuid NULL,
    CONSTRAINT pk_contribution_settings PRIMARY KEY (id)
);
INSERT INTO contribution_settings (id, enabled, reason, active_phase_id, updated_at, updated_by)
VALUES (1, false, 'communityTooSmall', NULL, now(), NULL)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS contribution_phases (
    id uuid NOT NULL,
    kind character varying(10) NOT NULL,
    state character varying(12) NOT NULL,
    opened_at timestamp with time zone NULL,
    ends_at timestamp with time zone NULL,
    closed_at timestamp with time zone NULL,
    source_phase_id uuid NULL,
    winner_candidate_id uuid NULL,
    created_at timestamp with time zone NOT NULL,
    created_by uuid NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    updated_by uuid NOT NULL,
    CONSTRAINT pk_contribution_phases PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS ix_contribution_phases_state ON contribution_phases (state);
-- At most one phase is open at a time.
CREATE UNIQUE INDEX IF NOT EXISTS ux_contribution_phases_one_open ON contribution_phases (state) WHERE state = 'open';

CREATE TABLE IF NOT EXISTS contribution_candidates (
    id uuid NOT NULL,
    phase_id uuid NOT NULL,
    position integer NOT NULL,
    name character varying(60) NOT NULL,
    name_translations jsonb NOT NULL DEFAULT '{}',
    description character varying(300) NOT NULL DEFAULT '',
    description_translations jsonb NOT NULL DEFAULT '{}',
    CONSTRAINT pk_contribution_candidates PRIMARY KEY (id),
    CONSTRAINT fk_contribution_candidates_contribution_phases_phase_id FOREIGN KEY (phase_id) REFERENCES contribution_phases (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_contribution_candidates_phase_id ON contribution_candidates (phase_id);

CREATE TABLE IF NOT EXISTS contribution_votes (
    phase_id uuid NOT NULL,
    user_id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    text character varying(1000) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_contribution_votes PRIMARY KEY (phase_id, user_id)
);

CREATE TABLE IF NOT EXISTS contribution_forms (
    id uuid NOT NULL,
    phase_id uuid NOT NULL,
    user_id uuid NOT NULL,
    photo_count integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_contribution_forms PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS ix_contribution_forms_phase_id_user_id ON contribution_forms (phase_id, user_id);

CREATE TABLE IF NOT EXISTS contribution_uploads (
    id uuid NOT NULL,
    phase_id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind character varying(16) NOT NULL,
    form_id uuid NULL,
    file_name character varying(80) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_contribution_uploads PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS ix_contribution_uploads_user_id_created_at ON contribution_uploads (user_id, created_at);
CREATE INDEX IF NOT EXISTS ix_contribution_uploads_phase_id_user_id_kind ON contribution_uploads (phase_id, user_id, kind);
COMMIT;
