CREATE TABLE IF NOT EXISTS post_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content_md TEXT,
    content_html TEXT,
    excerpt TEXT,
    cover_image TEXT,
    tags JSONB,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    summary VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_post_versions_post_id ON post_versions(post_id);
CREATE INDEX idx_post_versions_created_at ON post_versions(created_at);
