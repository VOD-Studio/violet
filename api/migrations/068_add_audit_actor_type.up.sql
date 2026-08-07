-- 068: audit_events 增加 actor_type 列，区分真人(user)与系统(system)操作。
-- 存量数据全为真人操作，回填默认值 'user'。
-- 列 NOT NULL DEFAULT 'user'：新写入漏填时降级为 user，不致脏数据。

ALTER TABLE audit_events
    ADD COLUMN actor_type VARCHAR(10) NOT NULL DEFAULT 'user';
