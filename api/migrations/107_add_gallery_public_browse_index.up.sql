-- 107: 公开图集浏览流的稳定复合游标索引（issue #283）

CREATE INDEX idx_galleries_published_cursor
    ON galleries(published_at DESC, id DESC)
    WHERE published_revision_id IS NOT NULL;
