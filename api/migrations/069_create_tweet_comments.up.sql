-- 069: tweet_comments 表（推文评论，PRD-0013 P2 / issue #107）
-- 独立评论实体挂推文下，两层扁平楼中楼（depth 0=顶层 / 1=回复），即发即出、物理删除。
-- tweet_id 级联删除：推文被物理删除时其评论自动由 DB 清理。
-- parent_id 自引用级联删除：删顶层评论时其回复链连带清理（与 comments 表同构）。

CREATE TABLE tweet_comments (
    id          UUID        PRIMARY KEY,
    tweet_id    UUID        NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
    author_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT        NOT NULL,
    parent_id   UUID        REFERENCES tweet_comments(id) ON DELETE CASCADE,
    path        TEXT        NOT NULL DEFAULT '',
    depth       SMALLINT    NOT NULL DEFAULT 0 CHECK (depth <= 1),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 推文详情页顶层评论列表：按 tweet_id 过滤 + depth=0 + created_at 倒序分页
CREATE INDEX idx_tweet_comments_tweet ON tweet_comments(tweet_id, depth, created_at DESC);

-- 按物化路径查某顶层下的全部回复（FindReplies 用 path 前缀 LIKE）
CREATE INDEX idx_tweet_comments_path ON tweet_comments(path);
