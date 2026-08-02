-- 065: 创建 audit_events 表（append-only 审计事件存储）
--
-- 设计原则：审计日志按定义不可变。应用层不提供 Update/Delete 路径，
-- 本表亦不设置允许 UPDATE/DELETE 的触发器/规则——存储层即不变量。
--
-- 字段与 infrastructure/persistence/gorm/audit_event_store.go 的 AuditEventPO 对齐：
--   - event_id      幂等去重（UNIQUE）
--   - action        受控枚举字符串
--   - actor_*       操作人快照（用户删除后仍可追溯）
--   - resource_*    资源快照（文章/用户删除后仍可追溯）
--   - changes       before/after 结构化变更（jsonb）
--   - metadata      兜底元数据（jsonb）

CREATE TABLE audit_events (
    id             BIGSERIAL    PRIMARY KEY,
    event_id       UUID         NOT NULL UNIQUE,
    action         VARCHAR(50)  NOT NULL,
    actor_user_id  UUID,
    actor_user_name VARCHAR(50),
    ip_address     VARCHAR(45),
    user_agent     VARCHAR(255),
    resource_type  VARCHAR(50)  NOT NULL,
    resource_id    VARCHAR(255),
    resource_name  VARCHAR(255),
    changes        JSONB,
    metadata       JSONB,
    occurred_at    TIMESTAMPTZ  NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 查询索引：后台按时间倒序浏览、按操作人/操作类型/资源类型过滤
CREATE INDEX idx_audit_events_occurred_at ON audit_events(occurred_at DESC);
CREATE INDEX idx_audit_events_actor_user_id ON audit_events(actor_user_id);
CREATE INDEX idx_audit_events_action ON audit_events(action);
CREATE INDEX idx_audit_events_resource_type ON audit_events(resource_type);
