-- 100: series 表（PRD-0021 / issue #260）
-- 文章合订成书：书是持续生长的组织容器，章节归属由 posts.series_id 承载（102）。

CREATE TABLE series (
    id          UUID          PRIMARY KEY,
    author_id   UUID          NOT NULL REFERENCES users(id),      -- 书的归属作者，创建时固定，不可变
    title       VARCHAR(255)  NOT NULL,
    slug        VARCHAR(255)  NOT NULL UNIQUE,                    -- 唯一，格式同 post slug，创建后不可改
    description TEXT          NOT NULL DEFAULT '',
    cover_image TEXT          NOT NULL DEFAULT '',                -- 封面图 URL，可空
    status      VARCHAR(16)   NOT NULL DEFAULT 'draft',           -- draft / published
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 前台书架：仅 published，按创建时间倒序
CREATE INDEX idx_series_public ON series(created_at DESC) WHERE status = 'published';

-- 后台管理列表
CREATE INDEX idx_series_author ON series(author_id, created_at DESC);
