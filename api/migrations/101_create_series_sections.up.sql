-- 101: series_sections 表（PRD-0021 / issue #260）
-- 书内卷/部（可选层级）：章节可挂某卷，也可不分卷直接挂书根。
-- 删除约束：service 层拒绝删除非空卷（有章节引用）；FK ON DELETE SET NULL
-- 仅作兜底（卷被强制删除时章节回到书根，归属不丢）。

CREATE TABLE series_sections (
    id         UUID         PRIMARY KEY,
    series_id  UUID         NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    title      VARCHAR(255) NOT NULL,
    sort_order INTEGER      NOT NULL DEFAULT 0,                   -- 卷在书内的顺序，越小越靠前
    created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 卷顺序唯一：一书内每个 sort_order 仅一卷（全量调序时仓储用两阶段写避开中间态冲突）
CREATE UNIQUE INDEX uniq_series_sections_order ON series_sections(series_id, sort_order);

-- 按书查目录
CREATE INDEX idx_series_sections_series ON series_sections(series_id, sort_order);
