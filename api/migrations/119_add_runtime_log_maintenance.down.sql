DROP TRIGGER IF EXISTS runtime_logs_usage_insert ON runtime_logs;
DROP TRIGGER IF EXISTS runtime_logs_usage_delete ON runtime_logs;
DROP FUNCTION IF EXISTS runtime_log_usage_after_insert();
DROP FUNCTION IF EXISTS runtime_log_usage_after_delete();
DROP TABLE IF EXISTS runtime_log_usage;
DROP TABLE IF EXISTS runtime_log_policy;
DROP INDEX IF EXISTS runtime_logs_received_at_idx;
ALTER TABLE runtime_logs DROP COLUMN IF EXISTS payload_bytes;
