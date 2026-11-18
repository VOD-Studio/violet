ALTER TABLE friendlinks
    ADD COLUMN rss_url text NOT NULL DEFAULT '',
    ADD COLUMN feed_status varchar(16) NOT NULL DEFAULT 'pending',
    ADD COLUMN site_status varchar(16) NOT NULL DEFAULT 'unchecked',
    ADD COLUMN checked_at timestamptz,
    ADD COLUMN latest_title text NOT NULL DEFAULT '',
    ADD COLUMN latest_url text NOT NULL DEFAULT '',
    ADD COLUMN latest_published_at timestamptz,
    ADD COLUMN next_refresh_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD CONSTRAINT friendlinks_feed_status CHECK (feed_status IN ('pending', 'no_feed', 'ok', 'empty', 'error')),
    ADD CONSTRAINT friendlinks_site_status CHECK (site_status IN ('unchecked', 'up', 'down'));

CREATE INDEX friendlinks_refresh_due ON friendlinks (next_refresh_at, id) WHERE status = 'approved';
CREATE INDEX friendlinks_recent_article ON friendlinks (latest_published_at DESC NULLS LAST, sort_order, id) WHERE status = 'approved';
