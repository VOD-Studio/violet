-- 077: audit_events 增加 summary 列（人话摘要，ADR-0009）。
-- 存量记录默认空串，前端降级到 action + resource 拼接展示。

ALTER TABLE audit_events
    ADD COLUMN summary TEXT NOT NULL DEFAULT '';
