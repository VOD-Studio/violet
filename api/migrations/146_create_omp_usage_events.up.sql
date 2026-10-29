CREATE TABLE omp_usage_events (
    user_id text NOT NULL,
    client_event_id varchar(128) NOT NULL CHECK (octet_length(client_event_id) BETWEEN 1 AND 128),
    provider varchar(128) NOT NULL CHECK (octet_length(provider) BETWEEN 1 AND 128),
    model varchar(256) NOT NULL CHECK (octet_length(model) BETWEEN 1 AND 256),
    input_tokens bigint NOT NULL CHECK (input_tokens BETWEEN 0 AND 9007199254740991),
    output_tokens bigint NOT NULL CHECK (output_tokens BETWEEN 0 AND 9007199254740991),
    cache_read_tokens bigint NOT NULL CHECK (cache_read_tokens BETWEEN 0 AND 9007199254740991),
    cache_write_tokens bigint NOT NULL CHECK (cache_write_tokens BETWEEN 0 AND 9007199254740991),
    reasoning_tokens bigint NOT NULL CHECK (reasoning_tokens BETWEEN 0 AND 9007199254740991),
    cost_total double precision NOT NULL CHECK (cost_total >= 0 AND cost_total <= 1000000000000),
    stop_reason varchar(32) NOT NULL CHECK (octet_length(stop_reason) BETWEEN 1 AND 32),
    is_error boolean NOT NULL,
    duration_ms double precision CHECK (duration_ms >= 0 AND duration_ms <= 9007199254740991),
    ttft_ms double precision CHECK (ttft_ms >= 0 AND ttft_ms <= 9007199254740991),
    is_subagent boolean NOT NULL,
    omp_version varchar(64) NOT NULL CHECK (octet_length(omp_version) BETWEEN 1 AND 64),
    occurred_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, client_event_id)
);

CREATE INDEX omp_usage_events_user_time_idx ON omp_usage_events (user_id, occurred_at);
