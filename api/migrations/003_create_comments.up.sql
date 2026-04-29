-- 评论表，支持嵌套回复
CREATE TABLE comments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id       UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    parent_id     UUID REFERENCES comments(id) ON DELETE CASCADE,
    path          TEXT NOT NULL,
    depth         SMALLINT NOT NULL DEFAULT 0 CHECK (depth <= 4),
    author_name   VARCHAR(100) NOT NULL,
    author_email  VARCHAR(255),
    author_url    TEXT,
    avatar_url    VARCHAR(512),
    body_md       TEXT NOT NULL,
    body_html     TEXT NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'spam', 'deleted')),
    ip_hash       VARCHAR(64),
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 按文章查询已审核评论，支持排序
CREATE INDEX idx_comments_post ON comments(post_id, created_at) WHERE status = 'approved';

-- 按路径查询嵌套评论
CREATE INDEX idx_comments_path ON comments(path);

-- 待审核评论查询
CREATE INDEX idx_comments_pending ON comments(created_at) WHERE status = 'pending';
