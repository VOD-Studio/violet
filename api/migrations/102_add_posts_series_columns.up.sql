-- 102: posts 加章节归属列（PRD-0021 / issue #260）
-- 章节归属放 posts 表而非独立关联表：读取路径（文章页取归属、书页取目录）单表直查；
-- series_id 单值即「一章只属一书」的物理约束（难逆决策见 PRD）。

ALTER TABLE posts
    ADD COLUMN series_id         UUID    REFERENCES series(id) ON DELETE SET NULL,          -- 挂入的书；NULL=不属任何书。书删除时自动解绑
    ADD COLUMN series_section_id UUID    REFERENCES series_sections(id) ON DELETE SET NULL, -- 挂入的卷；NULL=书根章节
    ADD COLUMN chapter_order     INTEGER;                                                      -- 所在范围（书根或某卷）内的相对序

-- 书页目录：一书全树按 (section, order) 取章。
-- 文章页归属反查走主键（series_id 列在行内），无需额外索引。
CREATE INDEX idx_posts_series ON posts(series_id, series_section_id, chapter_order);
