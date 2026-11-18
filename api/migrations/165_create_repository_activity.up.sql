CREATE TABLE repository_activity_sources (
    key TEXT PRIMARY KEY,
    repository_id BIGINT NOT NULL,
    default_branch TEXT NOT NULL,
    unavailable BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    data_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ,
    reason TEXT NOT NULL CHECK (reason IN ('', 'limited', 'failed')),
    retry_at TIMESTAMPTZ,
    commits JSONB NOT NULL,
    releases JSONB NOT NULL
);

CREATE INDEX idx_repository_activity_rate_limit ON repository_activity_sources (retry_at DESC)
    WHERE reason = 'limited' AND retry_at IS NOT NULL;

CREATE TABLE repository_activity_events (
    repository_id BIGINT NOT NULL CHECK (repository_id > 0),
    kind TEXT NOT NULL CHECK (kind IN ('commit', 'release')),
    source_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    seen_at TIMESTAMPTZ NOT NULL,
    activity_day DATE GENERATED ALWAYS AS (timezone('Asia/Shanghai', occurred_at)::date) STORED,
    activity_week DATE GENERATED ALWAYS AS (date_trunc('week', timezone('Asia/Shanghai', occurred_at))::date) STORED,
    PRIMARY KEY (repository_id, kind, source_id)
);

CREATE INDEX idx_repository_activity_days ON repository_activity_events
    (repository_id, activity_day DESC, kind, occurred_at DESC, source_id DESC);
