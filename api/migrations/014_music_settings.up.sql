-- 音乐播放器设置表
CREATE TABLE music_settings (
    id              INTEGER PRIMARY KEY DEFAULT 1,
    player_version  VARCHAR(10) NOT NULL DEFAULT 'v1' CHECK (player_version IN ('v1', 'v2')),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 插入默认设置
INSERT INTO music_settings (id, player_version) VALUES (1, 'v1');

-- 确保只有一个设置行
CREATE UNIQUE INDEX idx_music_settings_single ON music_settings(id);