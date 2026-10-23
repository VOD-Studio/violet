SELECT provider, model,
    count(*)::bigint AS requests,
    count(*) FILTER (WHERE is_error)::bigint AS errors,
    COALESCE(sum(input_tokens::numeric + output_tokens + cache_read_tokens + cache_write_tokens), 0)::double precision AS total_tokens,
    COALESCE(sum(input_tokens), 0)::double precision AS input_tokens,
    COALESCE(sum(output_tokens), 0)::double precision AS output_tokens,
    COALESCE(sum(cache_read_tokens), 0)::double precision AS cache_read_tokens,
    COALESCE(sum(cache_write_tokens), 0)::double precision AS cache_write_tokens,
    COALESCE(sum(reasoning_tokens), 0)::double precision AS reasoning_tokens,
    COALESCE(sum(cache_read_tokens)::numeric / NULLIF(sum(input_tokens::numeric + cache_read_tokens + cache_write_tokens), 0), 0)::double precision AS cache_rate,
    COALESCE(sum(cost_total), 0)::double precision AS cost,
    COALESCE(avg(output_tokens::double precision / NULLIF((duration_ms - ttft_ms) / 1000.0, 0))
        FILTER (WHERE NOT is_error AND duration_ms > ttft_ms), 0)::double precision AS avg_tokens_per_second,
    COALESCE(avg(ttft_ms), 0)::double precision AS avg_ttft_ms
FROM omp_usage_events
WHERE user_id = $1::text AND occurred_at >= $2::timestamptz AND occurred_at <= $3::timestamptz
GROUP BY provider, model
ORDER BY total_tokens DESC, provider ASC, model ASC;
