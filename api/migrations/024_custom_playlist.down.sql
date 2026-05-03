ALTER TABLE playlists DROP CONSTRAINT playlists_platform_check;
ALTER TABLE playlists ADD CONSTRAINT playlists_platform_check
  CHECK (platform IN ('netease', 'qq'));
