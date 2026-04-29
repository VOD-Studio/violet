-- 媒体管理表，统一管理图片、视频、音频、文档等文件
CREATE TABLE media (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename          VARCHAR(255) NOT NULL,
    original_name     VARCHAR(255) NOT NULL,
    mime_type         VARCHAR(100) NOT NULL,
    size              BIGINT NOT NULL DEFAULT 0,
    path              TEXT NOT NULL,
    width             INTEGER,
    height            INTEGER,
    duration          DOUBLE PRECISION,
    uploader_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    download_count    BIGINT NOT NULL DEFAULT 0,
    download_permission VARCHAR(20) NOT NULL DEFAULT 'public',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 按上传时间查询的索引
CREATE INDEX idx_media_created_at ON media(created_at DESC);

-- 按上传者查询的索引
CREATE INDEX idx_media_uploader_id ON media(uploader_id);

-- 按 MIME 类型筛选的索引
CREATE INDEX idx_media_mime_type ON media(mime_type);

-- 分片上传表，用于断点续传
CREATE TABLE upload_chunks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id     VARCHAR(64) NOT NULL,
    chunk_index   INTEGER NOT NULL,
    total_chunks  INTEGER NOT NULL,
    file_hash     VARCHAR(64),
    filename      VARCHAR(255),
    mime_type     VARCHAR(100),
    chunk_path    TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 按 upload_id 查询的索引
CREATE INDEX idx_upload_chunks_upload_id ON upload_chunks(upload_id);

-- 唯一约束：同一上传任务中分片索引不重复
CREATE UNIQUE INDEX idx_upload_chunks_unique ON upload_chunks(upload_id, chunk_index);
