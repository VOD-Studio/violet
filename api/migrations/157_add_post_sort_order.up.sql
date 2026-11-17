CREATE SEQUENCE post_sort_order_seq AS bigint INCREMENT BY -1 START WITH -1;

ALTER TABLE posts ADD COLUMN sort_order bigint;

WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY published_at DESC NULLS LAST, created_at DESC, id DESC) AS position
    FROM posts
)
UPDATE posts SET sort_order = ranked.position FROM ranked WHERE posts.id = ranked.id;

ALTER TABLE posts ALTER COLUMN sort_order SET NOT NULL;
ALTER TABLE posts ALTER COLUMN sort_order SET DEFAULT nextval('post_sort_order_seq');
ALTER SEQUENCE post_sort_order_seq OWNED BY posts.sort_order;

CREATE INDEX idx_posts_display_order ON posts (is_featured DESC, sort_order ASC, id DESC)
    WHERE deleted_at IS NULL;
