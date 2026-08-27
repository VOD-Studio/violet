-- 089: chat_messages 新增 shared_tweet_id（分享到聊天，PRD-0013 衍生）
-- 不建 FK 约束：被分享推文物理删除后保留该 ID，前台读时联结未命中渲染"推文已删除"占位
-- （与 070/074 tweets.quote_of 对已删除被引用推文的处理同构）。
ALTER TABLE chat_messages
    ADD COLUMN shared_tweet_id UUID;

CREATE INDEX idx_chat_messages_shared_tweet
    ON chat_messages(shared_tweet_id)
    WHERE shared_tweet_id IS NOT NULL;
