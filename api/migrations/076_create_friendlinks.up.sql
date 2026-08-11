-- 076: friendlinks 表 + friendlink 权限（PRD-0014 / issue #160）
-- 申请制友链：访客申请 → 站长审核 → 前台展示。
-- 四态状态机：pending/approved/rejected/disabled；approved ↔ disabled；物理删除。

CREATE TABLE friendlinks (
    id            UUID        PRIMARY KEY,
    user_id       UUID        REFERENCES users(id) ON DELETE SET NULL, -- 登录申请者；匿名申请与手动添加为 NULL
    name          VARCHAR(30) NOT NULL,
    url           TEXT        NOT NULL,
    avatar_url    TEXT        NOT NULL DEFAULT '',
    description   VARCHAR(80) NOT NULL DEFAULT '',
    owner_name    VARCHAR(30) NOT NULL DEFAULT '',
    linkback_url  TEXT        NOT NULL DEFAULT '',  -- 申请人填的回链页地址，审核参考
    contact_email VARCHAR(254) NOT NULL DEFAULT '', -- 归一化（小写+trim）；匿名必填，仅留存不公开
    status        VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending/approved/rejected/disabled
    sort_order    INTEGER     NOT NULL DEFAULT 0,   -- 越小越靠前
    ip_hash       VARCHAR(64) NOT NULL DEFAULT '',  -- 申请 IP 的 SHA256，配额与反垃圾元数据
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 前台展示：仅 approved，按 sort_order 升序（同权重按 created_at）
CREATE INDEX idx_friendlinks_public ON friendlinks(sort_order, created_at) WHERE status = 'approved';

-- url 占用去重：非 rejected 记录占住 url；rejected 不阻塞同一 url 重新申请
CREATE UNIQUE INDEX uniq_friendlinks_url_active ON friendlinks(url) WHERE status != 'rejected';

-- 申请配额：同一 (ip_hash, contact_email) 同时仅一个 pending（service 层先判 409，索引防并发穿透）
CREATE UNIQUE INDEX uniq_friendlinks_pending_identity ON friendlinks(ip_hash, contact_email) WHERE status = 'pending';

-- 后台审核队列：按状态筛选 + pending 计数
CREATE INDEX idx_friendlinks_status ON friendlinks(status, created_at DESC);

-- 权限：menu=friendlink 分组（sort 接续 071 的 tweet=14）+ friendlink:view / friendlink:manage
INSERT INTO permissions (code, name, type, parent_id, sort, is_builtin) VALUES
    ('friendlink', '友链', 'menu', NULL, 15, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('friendlink:view',   '查看友链管理', '友链管理页可见，查看友链列表与待审核计数', 'action', TRUE),
    ('friendlink:manage', '管理友链',     '友链审核（批准/拒绝/下柜/恢复）与增删改',   'action', TRUE)
ON CONFLICT (code) DO NOTHING;

UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu' AND m.code = 'friendlink'
  AND p.code IN ('friendlink:view', 'friendlink:manage');

-- seed 给 admin 角色（superadmin 靠 is_root 通配短路）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code IN ('friendlink:view', 'friendlink:manage')
ON CONFLICT DO NOTHING;
