CREATE TABLE presence_devices (
 id uuid PRIMARY KEY,
 display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 128),
 token_hash text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE presence_settings (
 id smallint PRIMARY KEY CHECK (id = 1),
 public_read boolean NOT NULL DEFAULT false
);
INSERT INTO presence_settings (id) VALUES (1);

INSERT INTO permissions (code,name,type,parent_id,sort,is_builtin)
VALUES ('presence','实时状态','menu',NULL,21,TRUE) ON CONFLICT (code) DO NOTHING;
INSERT INTO permissions (code,name,description,type,is_builtin) VALUES
 ('presence:view','查看实时状态','Nowbeam 设备列表、连接状态与公开设置','action',TRUE),
 ('presence:manage','管理实时状态','签发与撤销 Nowbeam 设备凭证、切换公开读取','action',TRUE)
ON CONFLICT (code) DO NOTHING;
UPDATE permissions p SET parent_id=m.id FROM permissions m
WHERE m.code='presence' AND m.type='menu' AND p.code IN ('presence:view','presence:manage');
INSERT INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id FROM roles r,permissions p
WHERE r.name='admin' AND p.code IN ('presence:view','presence:manage') ON CONFLICT DO NOTHING;
