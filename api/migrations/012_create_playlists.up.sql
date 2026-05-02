-- 音乐歌单表
CREATE TABLE playlists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    cover       VARCHAR(512),
    creator     VARCHAR(100),
    platform    VARCHAR(20) NOT NULL CHECK (platform IN ('netease', 'qq')),
    playlist_id VARCHAR(100) NOT NULL,
    song_count  INTEGER NOT NULL DEFAULT 0,
    songs       JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(platform, playlist_id)
);

-- 索引
CREATE INDEX idx_playlists_is_active ON playlists(is_active);
CREATE INDEX idx_playlists_platform ON playlists(platform);

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_playlists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER playlists_updated_at
    BEFORE UPDATE ON playlists
    FOR EACH ROW
    EXECUTE FUNCTION update_playlists_updated_at();