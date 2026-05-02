DROP TRIGGER IF EXISTS playlists_updated_at ON playlists;
DROP FUNCTION IF EXISTS update_playlists_updated_at();

DROP INDEX IF EXISTS idx_playlists_platform;
DROP INDEX IF EXISTS idx_playlists_is_active;

DROP TABLE IF EXISTS playlists;