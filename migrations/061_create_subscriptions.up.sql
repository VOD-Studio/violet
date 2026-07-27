-- 061: subscriptions 表（RSS 订阅源）
-- 承载用户注册的 RSS feed 订阅：feed URL + 抓取频率 + 转载标记 + 状态/失败计数。
-- 定时任务（T8）按 next_fetch_at 拉取 active 订阅，抓正文建草稿（T7）。

CREATE TABLE subscriptions (
    id                   UUID         PRIMARY KEY,
    user_id              UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type          VARCHAR(20)  NOT NULL DEFAULT 'rss',  -- 'rss'(本期) / 'page'(Phase 2 预留)
    feed_url             TEXT         NOT NULL,
    title                VARCHAR(255),
    interval             VARCHAR(20)  NOT NULL DEFAULT 'daily',  -- hourly/every-6h/daily/weekly
    auto_publish         BOOLEAN      NOT NULL DEFAULT FALSE,    -- 默认建草稿，true 直发
    canonical_override   TEXT,                                   -- 空=用 entry.link 作 canonical
    tags                 JSONB        NOT NULL DEFAULT '[]',
    status               VARCHAR(20)  NOT NULL DEFAULT 'active', -- active/paused
    consecutive_failures INTEGER      NOT NULL DEFAULT 0,
    last_error           TEXT,
    last_fetched_at      TIMESTAMPTZ,
    next_fetch_at        TIMESTAMPTZ,
    retry_after_until    TIMESTAMPTZ,                             -- 尊重 429 Retry-After
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 部分索引：调度器每轮只查 active 且 due 的订阅，过滤掉 paused 减少扫描
CREATE INDEX idx_subscriptions_due ON subscriptions(next_fetch_at) WHERE status = 'active';
-- 用户列表查询索引
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
