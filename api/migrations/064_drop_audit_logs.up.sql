-- 064: 删除旧 audit_logs 表
-- 旧表 schema 不适配新 AuditEvent 结构（8 位置参数时代的产物），
-- 由 065 audit_events 取代。当前表基本无有效数据，直接 drop。

DROP TABLE IF EXISTS audit_logs;
