-- 110: galleries 表（PRD-0022 / issue #264）
-- UGC 图集：一组有序媒体（图片 / mp4 / webm）+ 标题描述。即发即出，可编辑；
-- 管理员下架走软删（status=removed），作者删除走物理删（应用层先解绑引用计数）。

CREATE TABLE galleries (
    id            UUID          PRIMARY KEY,
    owner_id      UUID          NOT NULL REFERENCES users(id),    -- 创建者，固定不可变
    title         VARCHAR(255)  NOT NULL,
    description   TEXT          NOT NULL DEFAULT '',
    cover_file_id UUID          REFERENCES files(id),             -- 封面（可空，默认取首项媒体）
    status        VARCHAR(16)   NOT NULL DEFAULT 'published',     -- published / removed
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 全站浏览流：仅 published，按创建时间倒序
CREATE INDEX idx_galleries_public ON galleries(created_at DESC, id) WHERE status = 'published';

-- 用户主页图集 tab
CREATE INDEX idx_galleries_owner ON galleries(owner_id, created_at DESC);
