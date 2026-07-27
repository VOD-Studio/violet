-- 060: posts 增 canonical_url 列（转载/分发语义）
-- NULL = 原创；非 NULL = 转载/分发（指向源文章 URL）。
-- 命名对齐 Google rel=canonical 术语，与 Ghost / DEV.to / Bear Blog 共识一致。
-- 渲染层据此输出 <link rel="canonical"> 与转载样式（见 PRD-0005）。

ALTER TABLE posts ADD COLUMN canonical_url TEXT;
