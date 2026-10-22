DELETE FROM upload_sessions WHERE status = 'cancelled';
ALTER TABLE upload_sessions DROP COLUMN result_file_id;
COMMENT ON COLUMN upload_sessions.status IS '会话状态: active|merging|completed|expired';
