-- 文章浏览记录表，用于统计每日和每月浏览量
CREATE TABLE post_views (
    id          BIGSERIAL PRIMARY KEY,
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    ip_address  VARCHAR(45),
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 按日期查询浏览量的索引
CREATE INDEX idx_post_views_created_at ON post_views(created_at);

-- 按文章查询浏览量的索引
CREATE INDEX idx_post_views_post_id ON post_views(post_id);
