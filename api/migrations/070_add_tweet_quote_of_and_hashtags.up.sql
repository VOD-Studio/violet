-- 070: tweets.quote_of 引用与 tweet_hashtags 话题关联（PRD-0013 P3 / issues #109, #110）

-- 1. quote_of：转发引用的推文 ID。不建 FK 约束，保留被引用的 ID，被引用的推文删除后保留 quote_of 值前台渲染"推文已删除"占位
ALTER TABLE tweets ADD COLUMN quote_of UUID;
CREATE INDEX idx_tweets_quote_of ON tweets(quote_of) WHERE quote_of IS NOT NULL;

-- 2. tweet_hashtags：推文话题标签关联表。推文物理删除时级联删除其话题关联
CREATE TABLE tweet_hashtags (
    tweet_id   UUID        NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
    tag        VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tweet_id, tag)
);

-- 话题时间线 keyset 分页索引
CREATE INDEX idx_tweet_hashtags_tag ON tweet_hashtags (tag, created_at DESC, tweet_id DESC);
