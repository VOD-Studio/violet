DROP TRIGGER IF EXISTS stickers_updated_at ON stickers;
DROP TRIGGER IF EXISTS sticker_groups_updated_at ON sticker_groups;
DROP FUNCTION IF EXISTS update_stickers_updated_at();
DROP FUNCTION IF EXISTS update_sticker_groups_updated_at();

DROP INDEX IF EXISTS idx_user_favorite_stickers_user;
DROP INDEX IF EXISTS idx_sticker_groups_sort_order;
DROP INDEX IF EXISTS idx_stickers_usage_count;
DROP INDEX IF EXISTS idx_stickers_group_id;

DROP TABLE IF EXISTS user_favorite_stickers;
DROP TABLE IF EXISTS stickers;
DROP TABLE IF EXISTS sticker_groups;