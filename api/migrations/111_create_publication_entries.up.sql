-- 111: 首页统一发布物读取投影（PRD-0024，issue #306）

CREATE TABLE publication_entries (
    kind         VARCHAR(16)  NOT NULL CHECK (kind IN ('article', 'note', 'gallery')),
    source_id    UUID         NOT NULL,
    route_key    VARCHAR(255) NOT NULL,
    title        VARCHAR(255) NOT NULL,
    published_at TIMESTAMPTZ  NOT NULL,
    featured     BOOLEAN      NOT NULL DEFAULT false CHECK (kind = 'article' OR featured = false),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (kind, source_id)
);

CREATE INDEX idx_publication_entries_stream
    ON publication_entries(published_at DESC, kind ASC, source_id DESC)
    INCLUDE (route_key, title, featured);

INSERT INTO publication_entries (kind, source_id, route_key, title, published_at, featured)
SELECT 'article', id, slug, title, published_at, is_featured
FROM posts
WHERE status = 'published' AND published_at IS NOT NULL AND deleted_at IS NULL
UNION ALL
SELECT 'note', id, id::text,
       COALESCE(
           NULLIF(BTRIM(title), ''),
           CASE
               WHEN CHAR_LENGTH(note_text) > 48 THEN LEFT(note_text, 48) || '…'
               ELSE note_text
           END,
           '无题笔记'
       ),
       published_at, false
FROM (
    SELECT notes.*,
           NULLIF(BTRIM(REGEXP_REPLACE(REGEXP_REPLACE(content_html, '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g')), '') AS note_text
    FROM notes
) published_notes
WHERE status = 'published' AND published_at IS NOT NULL
UNION ALL
SELECT 'gallery', g.id, g.slug, COALESCE(NULLIF(BTRIM(r.title), ''), '无题图集'), g.published_at, false
FROM galleries g
JOIN gallery_revisions r
    ON r.id = g.published_revision_id AND r.gallery_id = g.id
WHERE g.published_revision_id IS NOT NULL
  AND g.published_at IS NOT NULL
  AND g.slug IS NOT NULL
ON CONFLICT (kind, source_id) DO UPDATE SET
    route_key = EXCLUDED.route_key,
    title = EXCLUDED.title,
    published_at = EXCLUDED.published_at,
    featured = EXCLUDED.featured,
    updated_at = CURRENT_TIMESTAMP;
