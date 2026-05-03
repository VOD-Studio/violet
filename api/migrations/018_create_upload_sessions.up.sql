-- 分片上传会话表，管理断点续传
CREATE TABLE upload_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_size       BIGINT NOT NULL,
    file_hash       CHAR(32) NOT NULL,                   -- MD5
    mime_type       VARCHAR(100) NOT NULL,
    chunk_size      INTEGER NOT NULL DEFAULT 5242880,    -- 每片 5MB
    total_chunks    INTEGER NOT NULL,
    uploaded_chunks JSONB NOT NULL DEFAULT '[]'::jsonb,  -- 已完成分片索引 [0,1,2,...]
    status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active|merging|completed|expired
    tmp_path        VARCHAR(500) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_upload_sessions_user ON upload_sessions(user_id);
CREATE INDEX idx_upload_sessions_hash ON upload_sessions(file_hash);
CREATE INDEX idx_upload_sessions_status ON upload_sessions(status);
CREATE INDEX idx_upload_sessions_expires ON upload_sessions(expires_at);

COMMENT ON TABLE upload_sessions IS '分片上传会话';
COMMENT ON COLUMN upload_sessions.uploaded_chunks IS '已完成分片索引，JSON 数组';
COMMENT ON COLUMN upload_sessions.status IS '会话状态: active|merging|completed|expired';
