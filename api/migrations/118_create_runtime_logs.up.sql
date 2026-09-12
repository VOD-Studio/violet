CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE runtime_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    level VARCHAR(8) NOT NULL CHECK (level IN ('trace','debug','info','warn','error','fatal','panic')),
    source VARCHAR(128) NOT NULL,
    message TEXT NOT NULL CHECK (octet_length(message) <= 8192),
    request_id VARCHAR(128) NOT NULL DEFAULT '',
    trace_id VARCHAR(128) NOT NULL DEFAULT ''
);
CREATE INDEX runtime_logs_occurred_at_idx ON runtime_logs (occurred_at, id);
CREATE INDEX runtime_logs_level_id_idx ON runtime_logs (level, id);
CREATE INDEX runtime_logs_source_id_idx ON runtime_logs (source, id);
CREATE INDEX runtime_logs_request_id_idx ON runtime_logs (request_id, id) WHERE request_id <> '';
CREATE INDEX runtime_logs_trace_id_idx ON runtime_logs (trace_id, id) WHERE trace_id <> '';
CREATE INDEX runtime_logs_message_idx ON runtime_logs USING GIN (message gin_trgm_ops);

INSERT INTO permissions (code, name, type, sort, is_builtin)
VALUES ('runtimelog', '运行日志', 'menu', 20, TRUE)
ON CONFLICT (code) DO NOTHING;
INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('runtimelog:view', '查看运行日志', '读取、订阅和导出已脱敏运行日志，不包含操作审计权限', 'action', TRUE),
    ('runtimelog:manage', '管理运行日志策略', '修改运行日志保留策略，不允许清理操作审计', 'action', TRUE)
ON CONFLICT (code) DO NOTHING;
UPDATE permissions p SET parent_id = m.id FROM permissions m
WHERE m.code = 'runtimelog' AND p.code IN ('runtimelog:view','runtimelog:manage');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code IN ('runtimelog:view','runtimelog:manage')
ON CONFLICT DO NOTHING;
-- 只授权默认 admin 角色；其他具有 log:view 的角色不会继承运行日志权限。
