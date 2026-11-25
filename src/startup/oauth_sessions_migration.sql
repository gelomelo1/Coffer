-- Sign-in with Google, Facebook, Discord or GitHub and server-side sessions: every access token belongs to a session, refresh tokens are stored hashed and
-- rotate on every use. Safe to re-run.
-- Run with:  docker compose -f docker-compose.dev.yml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < startup/oauth_sessions_migration.sql
BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_provider_check;
ALTER TABLE users ADD CONSTRAINT users_provider_check
    CHECK (provider = ANY (ARRAY['google'::text, 'facebook'::text, 'discord'::text, 'github'::text]));

CREATE TABLE IF NOT EXISTS auth_sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    last_used_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone NULL,
    revoke_reason character varying(40) NULL,
    CONSTRAINT pk_auth_sessions PRIMARY KEY (id),
    CONSTRAINT fk_auth_sessions_users_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_auth_sessions_user_id ON auth_sessions (user_id);

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
    id uuid NOT NULL,
    session_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone NULL,
    CONSTRAINT pk_auth_refresh_tokens PRIMARY KEY (id),
    CONSTRAINT fk_auth_refresh_tokens_auth_sessions_session_id FOREIGN KEY (session_id) REFERENCES auth_sessions (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_auth_refresh_tokens_token_hash ON auth_refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS ix_auth_refresh_tokens_session_id ON auth_refresh_tokens (session_id);

COMMIT;
