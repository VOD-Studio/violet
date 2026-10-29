WITH inserted AS (
    INSERT INTO omp_usage_events (
        user_id, client_event_id, provider, model, input_tokens, output_tokens,
        cache_read_tokens, cache_write_tokens, reasoning_tokens, cost_total,
        stop_reason, is_error, duration_ms, ttft_ms, is_subagent, omp_version, occurred_at
    )
    SELECT $1::text, e.client_event_id, e.provider, e.model, e.input_tokens, e.output_tokens,
        e.cache_read_tokens, e.cache_write_tokens, e.reasoning_tokens, e.cost_total,
        e.stop_reason, e.is_error, e.duration_ms, e.ttft_ms, e.is_subagent, e.omp_version, e.occurred_at
    FROM jsonb_to_recordset($2::jsonb) AS e(
        client_event_id text, provider text, model text, input_tokens bigint, output_tokens bigint,
        cache_read_tokens bigint, cache_write_tokens bigint, reasoning_tokens bigint, cost_total double precision,
        stop_reason text, is_error boolean, duration_ms double precision, ttft_ms double precision,
        is_subagent boolean, omp_version text, occurred_at timestamptz
    )
    ON CONFLICT (user_id, client_event_id) DO NOTHING
    RETURNING 1
)
SELECT count(*)::bigint AS accepted,
    (jsonb_array_length($2::jsonb) - count(*))::bigint AS duplicated
FROM inserted;
