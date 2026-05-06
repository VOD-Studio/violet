-- 公告表
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'info',  -- info/warning/success/error
    is_active BOOLEAN NOT NULL DEFAULT true,
    start_time TIMESTAMPTZ,  -- 生效开始时间（可选）
    end_time TIMESTAMPTZ,    -- 生效结束时间（可选）
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_announcements_is_active ON announcements(is_active);
CREATE INDEX idx_announcements_start_time ON announcements(start_time);
CREATE INDEX idx_announcements_end_time ON announcements(end_time);

-- 公告类型说明：
-- info: 普通通知（蓝色）
-- warning: 警告通知（橙色）
-- success: 成功通知（绿色）
-- error: 错误通知（红色）