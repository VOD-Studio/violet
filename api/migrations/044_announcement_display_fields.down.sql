-- 回滚公告展示形态扩展字段
DROP INDEX IF EXISTS idx_announcements_sort_order;
ALTER TABLE announcements DROP CONSTRAINT IF EXISTS chk_announcements_display;
ALTER TABLE announcements
    DROP COLUMN IF EXISTS display,
    DROP COLUMN IF EXISTS sort_order,
    DROP COLUMN IF EXISTS affects,
    DROP COLUMN IF EXISTS content_md,
    DROP COLUMN IF EXISTS content_html,
    DROP COLUMN IF EXISTS cover_image,
    DROP COLUMN IF EXISTS excerpt;
