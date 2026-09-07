-- 112: 匿名设备印记（PRD-0024，issue #309）

CREATE TABLE site_impressions (
    token_hash BYTEA       PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
