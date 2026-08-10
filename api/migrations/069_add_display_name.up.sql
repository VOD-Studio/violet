-- 用户表新增 display_name 列（显示名/昵称，可空，允许重复）
--
-- 与 username 职责分离：
--   username  —— 唯一登录标识（@xxx 寻址、URL slug），注册后不变
--   display_name —— 展示名（个人主页/评论/作者署名），可空、可重复、可随时改
--
-- 空串表示未设置，前端展示时回退到 username（Discord/GitHub 模式）。
-- 存量数据：默认空串，自动回退 username 展示，无需回填。
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(32) DEFAULT '';

-- username 规则收紧为纯 ASCII（[a-zA-Z0-9_-]），含中文/非 ASCII 的存量 username
-- 复制到 display_name 保留展示名，然后给 username 追加随机后缀使其满足新规则。
-- 用户随后可在 profile 页把 display_name 设回原名、username 改成想要的 ASCII 名。
WITH non_ascii AS (
    SELECT id, username FROM users WHERE username !~ '^[a-zA-Z0-9_-]{3,32}$'
)
UPDATE users u SET display_name = na.username
FROM non_ascii na
WHERE u.id = na.id AND u.display_name = '';

-- 给不合规的 username 替换为随机 ASCII 名（原中文 username 无法保留为登录标识，
-- 已复制到 display_name）。前缀 user_ + MD5 随机片段，保证满足 [a-zA-Z0-9_-]{3,32}。
UPDATE users
SET username = 'user_' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 10)
WHERE username !~ '^[a-zA-Z0-9_-]{3,32}$';
