CREATE TABLE tweet_comment_reactions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES tweet_comments(id) ON DELETE CASCADE,
    emoji_id   INTEGER NOT NULL REFERENCES emojis(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tweet_comment_reaction UNIQUE (comment_id, emoji_id, user_id)
);

CREATE INDEX idx_tweet_comment_reactions_recent
    ON tweet_comment_reactions(comment_id, emoji_id, created_at DESC, id DESC);
CREATE INDEX idx_tweet_comment_reactions_user
    ON tweet_comment_reactions(user_id);
CREATE INDEX idx_tweet_comment_reactions_emoji
    ON tweet_comment_reactions(emoji_id);
