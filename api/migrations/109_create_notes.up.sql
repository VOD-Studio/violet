-- 109: 笔记表与标签关联（PRD-0024，issue #296）

CREATE TABLE notes (
    id UUID PRIMARY KEY,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(120) NOT NULL DEFAULT '',
    content_md TEXT NOT NULL,
    content_html TEXT NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 后台管理列表：按作者 + 创建时间倒序。
CREATE INDEX idx_notes_author_created ON notes(author_id, created_at DESC, id DESC);

-- 公开流 keyset 分页：仅已发布行进部分索引（草稿不占索引）。
CREATE INDEX idx_notes_published_cursor ON notes(published_at DESC, id DESC) WHERE status = 'published';

CREATE TABLE note_tags (
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX idx_note_tags_tag ON note_tags(tag_id);
