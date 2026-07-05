-- 评论选区批注锚点（PRD-0001 Issue-0003）
--
-- 5 列全部 nullable：自由评论（anchor 为空）或批注（anchor 非空）。
-- CHECK 约束保证「批注强制登录」：anchor 非空时 created_by 必须非空。
-- 见 PRD-0001「身份与状态」段与 Issue-0003 acceptance criteria。

ALTER TABLE comments ADD COLUMN IF NOT EXISTS anchor_block_id       VARCHAR(16);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS anchor_start_offset   INTEGER;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS anchor_end_offset     INTEGER;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS anchor_selected_text  TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS anchor_block_text_hash VARCHAR(16);

-- 批注强制登录：anchor_block_id 非空（即这是一条批注）时 created_by 必须非空。
-- 在 DB 层兜底防绕过（handler/domain 层已各自做校验，三层纵深防御）。
ALTER TABLE comments ADD CONSTRAINT chk_anchor_requires_login
    CHECK (anchor_block_id IS NULL OR created_by IS NOT NULL);

COMMENT ON COLUMN comments.anchor_block_id        IS '锚点块标识符（块纯文本 SHA1 前 8 位，跨渲染稳定）';
COMMENT ON COLUMN comments.anchor_start_offset    IS '选区起始偏移（块内字符位，0-based）';
COMMENT ON COLUMN comments.anchor_end_offset      IS '选区结束偏移（块内字符位，exclusive）';
COMMENT ON COLUMN comments.anchor_selected_text   IS '选中原文（fuzzy 重定位的锚）';
COMMENT ON COLUMN comments.anchor_block_text_hash IS '块内容快照（创建时的 SHA1 前 8 位，漂移检测）';
