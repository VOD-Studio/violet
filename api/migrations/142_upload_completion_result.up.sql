ALTER TABLE upload_sessions
    ADD COLUMN result_file_id UUID REFERENCES files(id) ON DELETE SET NULL;

COMMENT ON COLUMN upload_sessions.result_file_id IS '完成上传时原子提交的正式文件；旧会话可能为空';
COMMENT ON COLUMN upload_sessions.status IS '会话状态: active|merging|completed|cancelled|expired';
