-- 评论双轨认证：新增 created_by 列（登录用户 id），保留匿名 author_* 模式。
-- 同时为「一篇一次」匿名配额（per post_id + ip_hash + author_email）建索引。
-- 见 PRD-0001「身份与状态」段。

-- created_by：登录评论者的用户 id，匿名为 NULL。
ALTER TABLE comments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN comments.created_by IS '登录评论者的用户 id；匿名为 NULL（双轨认证，PRD-0001）';

-- 索引：支撑「同一 (ip_hash, author_email) 在同一文章下仅能评论一次」的 O(1) 查询。
-- 仅计 pending/approved（spam/deleted 不占配额）。
CREATE INDEX IF NOT EXISTS idx_comments_anon_quota
    ON comments (post_id, ip_hash, author_email)
    WHERE status IN ('pending', 'approved');
