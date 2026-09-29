-- OAuth 凭据单行表：后台保存的持久化介质（admin 权限域，不随公开 settings 下发）。
-- .env 仅作首次部署种子；本表非空字段启动时覆盖 env 初值。
CREATE TABLE oauth_credentials (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    google_client_id TEXT NOT NULL DEFAULT '',
    github_client_id TEXT NOT NULL DEFAULT '',
    github_client_secret TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
