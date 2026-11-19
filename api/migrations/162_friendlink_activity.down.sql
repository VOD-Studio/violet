DROP INDEX IF EXISTS friendlinks_recent_article;
DROP INDEX IF EXISTS friendlinks_refresh_due;
ALTER TABLE friendlinks
    DROP CONSTRAINT friendlinks_site_status,
    DROP CONSTRAINT friendlinks_feed_status,
    DROP COLUMN next_refresh_at,
    DROP COLUMN latest_published_at,
    DROP COLUMN latest_url,
    DROP COLUMN latest_title,
    DROP COLUMN checked_at,
    DROP COLUMN site_status,
    DROP COLUMN feed_status,
    DROP COLUMN rss_url;
