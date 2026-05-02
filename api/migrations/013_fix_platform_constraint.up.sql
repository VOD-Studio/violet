-- 修复平台约束，使用 Meting API 的平台名称
-- 先更新现有数据
UPDATE playlists SET platform = 'tencent' WHERE platform = 'qq';

-- 再修改约束
ALTER TABLE playlists DROP CONSTRAINT playlists_platform_check;
ALTER TABLE playlists ADD CONSTRAINT playlists_platform_check CHECK (platform IN ('netease', 'tencent'));