-- News posts written in Coffer.Manager (drafts stay there; the app reads published ones). Images live in IMAGESTORE_PATH/news.
-- Run with:  docker compose -f docker-compose.dev.yml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < startup/news_migration.sql
BEGIN;
CREATE TABLE IF NOT EXISTS news_posts (
    id uuid NOT NULL,
    title character varying(120) NOT NULL,
    hero_image character varying(80) NULL,
    content text NOT NULL DEFAULT '',
    status character varying(20) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    published_at timestamp with time zone NULL,
    edited_at timestamp with time zone NULL,
    created_by uuid NOT NULL,
    updated_by uuid NOT NULL,
    CONSTRAINT pk_news_posts PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS ix_news_posts_status_published_at ON news_posts (status, published_at);
COMMIT;
