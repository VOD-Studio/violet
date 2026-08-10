-- 072: tweet_likes 表（推文点赞，PRD-0013 / issue #105）
-- 记录用户点赞关系，PRIMARY KEY(tweet_id, user_id) 保证唯一性与重复点赞幂等；
-- tweet_id 级联删除，当推文被物理删除时自动被 DB 清理。

CREATE TABLE tweet_likes (
    tweet_id   UUID        NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tweet_id, user_id)
);

CREATE INDEX idx_tweet_likes_user ON tweet_likes(user_id, created_at DESC);
