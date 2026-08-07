-- 066: tweets 表（推文，PRD-0013 / issue #101）
-- 多用户微博：纯文本（≤500 字）+ 最多 4 张图，即发即出、不可编辑、物理删除。
-- like_count 是 tweet_likes（T5 建表）的冗余计数列，服务时间线列表性能。

CREATE TABLE tweets (
    id          UUID        PRIMARY KEY,
    author_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT        NOT NULL DEFAULT '',
    images      JSONB       NOT NULL DEFAULT '[]',       -- 图片访问 URL 数组（/uploads/...）
    like_count  INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 全局时间线 keyset 分页：WHERE author 无关，(created_at, id) 复合游标倒序。
-- 查询形态 WHERE (created_at, id) < cursor ORDER BY created_at DESC, id DESC，
-- 索引两列同向 DESC 才能直接供序（混合排序需额外 sort）。
CREATE INDEX idx_tweets_timeline ON tweets(created_at DESC, id DESC);

-- 用户主页推文列表：按作者过滤的同构 keyset 分页
CREATE INDEX idx_tweets_author ON tweets(author_id, created_at DESC, id DESC);
