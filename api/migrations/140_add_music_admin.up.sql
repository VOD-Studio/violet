CREATE TABLE music_account (
 id smallint PRIMARY KEY CHECK (id = 1),
 generation bigint NOT NULL DEFAULT 0,
 sealed_cookie text NOT NULL DEFAULT '',
 profile_id text NOT NULL DEFAULT '',
 nickname text NOT NULL DEFAULT '',
 avatar_url text NOT NULL DEFAULT ''
);
INSERT INTO music_account (id) VALUES (1);

CREATE TABLE music_login_challenges (
 id text PRIMARY KEY,
 owner_id text NOT NULL,
 key text NOT NULL,
 generation bigint NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE INDEX music_login_challenges_expiry ON music_login_challenges (expires_at);

CREATE TABLE music_featured_playlists (
 id text PRIMARY KEY CHECK (id ~ '^[1-9][0-9]*$'),
 name text NOT NULL,
 cover_url text NOT NULL,
 track_count integer NOT NULL,
 creator text NOT NULL,
 enabled boolean NOT NULL DEFAULT true,
 position integer NOT NULL CHECK (position >= 0)
);
CREATE INDEX music_featured_playlists_order ON music_featured_playlists (position, id);

INSERT INTO permissions (code,name,type,parent_id,sort,is_builtin)
VALUES ('music','音乐','menu',NULL,20,TRUE) ON CONFLICT (code) DO NOTHING;
INSERT INTO permissions (code,name,description,type,is_builtin) VALUES
 ('music:view','查看音乐','音乐连接状态、音乐库与展示歌单','action',TRUE),
 ('music:manage','管理音乐','连接站点网易云账号与管理展示歌单','action',TRUE)
ON CONFLICT (code) DO NOTHING;
UPDATE permissions p SET parent_id=m.id FROM permissions m
WHERE m.code='music' AND m.type='menu' AND p.code IN ('music:view','music:manage');
INSERT INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id FROM roles r,permissions p
WHERE r.name='admin' AND p.code IN ('music:view','music:manage') ON CONFLICT DO NOTHING;
