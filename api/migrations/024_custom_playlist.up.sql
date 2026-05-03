-- 支持自定义歌单（上传音频文件）
ALTER TABLE playlists DROP CONSTRAINT playlists_platform_check;
ALTER TABLE playlists ADD CONSTRAINT playlists_platform_check
  CHECK (platform IN ('netease', 'qq', 'custom'));
