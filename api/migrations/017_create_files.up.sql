-- 文件管理表，统一管理所有上传文件的生命周期
CREATE TABLE files (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      UUID NOT NULL,
    file_type     VARCHAR(20) NOT NULL,                -- avatar|post|emoji|material
    original_name VARCHAR(255) NOT NULL,
    path          VARCHAR(500) NOT NULL,
    url           VARCHAR(500) NOT NULL,
    size          BIGINT NOT NULL,
    mime_type     VARCHAR(100) NOT NULL,
    file_hash     CHAR(32) NOT NULL,                   -- MD5，用于秒传
    width         INTEGER,
    height        INTEGER,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|processing|ready|failed|deleted
    ref_count     INTEGER NOT NULL DEFAULT 0,           -- 引用计数，>0 禁止物理删除
    deleted_at    TIMESTAMPTZ,                          -- 软删除时间戳
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_files_owner ON files(owner_id);
CREATE INDEX idx_files_hash ON files(file_hash);
CREATE INDEX idx_files_status ON files(status);
CREATE INDEX idx_files_deleted ON files(deleted_at);

COMMENT ON TABLE files IS '文件记录';
COMMENT ON COLUMN files.file_type IS '文件类型: avatar|post|emoji|material';
COMMENT ON COLUMN files.file_hash IS 'MD5 哈希，用于秒传';
COMMENT ON COLUMN files.status IS '文件状态: pending|processing|ready|failed|deleted';
COMMENT ON COLUMN files.ref_count IS '引用计数，>0 禁止物理删除';
