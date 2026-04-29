-- 文章表
CREATE TABLE posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) UNIQUE NOT NULL,
    content_md      TEXT NOT NULL,
    content_html    TEXT NOT NULL,
    excerpt         TEXT,
    cover_image     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',
    author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    view_count      INTEGER NOT NULL DEFAULT 0,
    is_featured     BOOLEAN NOT NULL DEFAULT false,
    seo_title       VARCHAR(255),
    seo_description TEXT,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 文章 slug 索引，用于前端按 slug 查询
CREATE INDEX idx_posts_slug ON posts(slug);

-- 文章状态索引，用于按状态筛选
CREATE INDEX idx_posts_status ON posts(status);

-- 文章发布时间索引，用于按时间排序
CREATE INDEX idx_posts_published_at ON posts(published_at DESC);

-- 文章作者索引
CREATE INDEX idx_posts_author ON posts(author_id);

-- 标签表
CREATE TABLE tags (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(50) UNIQUE NOT NULL,
    slug  VARCHAR(50) UNIQUE NOT NULL
);

-- 文章标签关联表
CREATE TABLE post_tags (
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

-- 按标签查询文章的索引
CREATE INDEX idx_post_tags_tag ON post_tags(tag_id);
