-- 062: subscription_entries 表（订阅源条目去重锚点）
-- 每次 FetchOne 拉 feed 后，对每条 entry 查此表过滤已处理；
-- (subscription_id, guid) UNIQUE 保证幂等，guid 缺失时回退到 link。
-- 删除订阅时 ON DELETE CASCADE 连带清理条目。

CREATE TABLE subscription_entries (
    id              BIGSERIAL    PRIMARY KEY,
    subscription_id UUID         NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    guid            TEXT         NOT NULL,                 -- entry guid，无则回退 link
    entry_url       TEXT,                                  -- entry.link（源文章 URL）
    title           VARCHAR(255),
    post_id         UUID,                                  -- 建草稿后回填 posts.id
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending', -- pending/imported/failed/dead
    fail_count      INTEGER      NOT NULL DEFAULT 0,
    last_error      TEXT,
    published_at    TIMESTAMPTZ,                           -- entry 发布时间
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subscription_id, guid)                          -- 去重锚点
);

-- 调度器按 subscription_id 查待处理条目
CREATE INDEX idx_subscription_entries_sub ON subscription_entries(subscription_id);
-- 按 status 过滤（查 failed 重试 / imported 统计）
CREATE INDEX idx_subscription_entries_status ON subscription_entries(status);
