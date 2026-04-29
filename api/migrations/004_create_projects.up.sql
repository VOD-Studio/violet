-- 项目展示表
CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    url         TEXT,
    github_url  TEXT,
    image_url   TEXT,
    tech_stack  TEXT[],
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 站点设置表
CREATE TABLE site_settings (
    key       VARCHAR(100) PRIMARY KEY,
    value     TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
