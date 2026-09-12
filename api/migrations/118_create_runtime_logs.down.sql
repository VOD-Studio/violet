DELETE FROM role_permissions WHERE permission_id IN (
    SELECT id FROM permissions WHERE code IN ('runtimelog:view','runtimelog:manage')
);
DELETE FROM permissions WHERE code IN ('runtimelog:view','runtimelog:manage');
DELETE FROM permissions WHERE code = 'runtimelog';
DROP TABLE IF EXISTS runtime_logs;
-- pg_trgm 可能被其他模块或部署对象使用，回滚本模块不删除扩展。
