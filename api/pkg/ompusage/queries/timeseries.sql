WITH buckets AS (
    SELECT instant AT TIME ZONE 'UTC' AS timestamp
    FROM generate_series(
        date_trunc($4::text, $2::timestamptz AT TIME ZONE 'UTC'),
        date_trunc($4::text, $3::timestamptz AT TIME ZONE 'UTC'),
        CASE $4::text WHEN 'hour' THEN interval '1 hour' ELSE interval '1 day' END
    ) AS instant
), totals AS (
    SELECT date_trunc($4::text, occurred_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS timestamp,
        count(*)::bigint AS requests,
        count(*) FILTER (WHERE is_error)::bigint AS errors,
        sum(input_tokens::numeric + output_tokens + cache_read_tokens + cache_write_tokens)::double precision AS total_tokens,
        sum(cost_total)::double precision AS api_cost_estimate
    FROM omp_usage_events
    WHERE user_id = $1::text AND occurred_at >= $2::timestamptz AND occurred_at <= $3::timestamptz
    GROUP BY 1
)
SELECT b.timestamp, COALESCE(t.requests, 0)::bigint AS requests,
    COALESCE(t.errors, 0)::bigint AS errors,
    COALESCE(t.total_tokens, 0)::double precision AS total_tokens,
    COALESCE(t.api_cost_estimate, 0)::double precision AS api_cost_estimate
FROM buckets b LEFT JOIN totals t USING (timestamp)
ORDER BY b.timestamp;
