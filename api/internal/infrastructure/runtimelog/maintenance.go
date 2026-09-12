package runtimelog

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	domainlog "blog-api/internal/domain/runtimelog"
)

func (s *Store) GetPolicy(ctx context.Context) (domainlog.Policy, error) {
	var policy domainlog.Policy
	err := s.db.QueryRowContext(ctx, `
		SELECT version, retention_days, max_records, max_bytes, updated_at
		FROM runtime_log_policy
		WHERE singleton = TRUE
	`).Scan(&policy.Version, &policy.RetentionDays, &policy.MaxRecords, &policy.MaxBytes, &policy.UpdatedAt)
	if err != nil {
		return domainlog.Policy{}, fmt.Errorf("read runtime log policy: %w", err)
	}
	return policy, nil
}

func (s *Store) UpdatePolicy(ctx context.Context, expected int64, next domainlog.Policy) (domainlog.Policy, error) {
	var saved domainlog.Policy
	err := s.db.QueryRowContext(ctx, `
		UPDATE runtime_log_policy
		SET retention_days = $1,
		    max_records = $2,
		    max_bytes = $3,
		    version = version + 1,
		    updated_at = clock_timestamp()
		WHERE singleton = TRUE AND version = $4
		RETURNING version, retention_days, max_records, max_bytes, updated_at
	`, next.RetentionDays, next.MaxRecords, next.MaxBytes, expected).
		Scan(&saved.Version, &saved.RetentionDays, &saved.MaxRecords, &saved.MaxBytes, &saved.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return domainlog.Policy{}, domainlog.ErrPolicyVersionConflict
	}
	if err != nil {
		return domainlog.Policy{}, fmt.Errorf("update runtime log policy: %w", err)
	}
	return saved, nil
}

func (s *Store) Usage(ctx context.Context) (domainlog.Usage, error) {
	var usage domainlog.Usage
	var oldest, newest sql.NullTime
	err := s.db.QueryRowContext(ctx, `
		SELECT usage.records,
		       usage.payload_bytes,
		       oldest.received_at,
		       newest.received_at
		FROM runtime_log_usage AS usage
		LEFT JOIN LATERAL (
			SELECT received_at
			FROM runtime_logs
			ORDER BY received_at ASC, id ASC
			LIMIT 1
		) AS oldest ON TRUE
		LEFT JOIN LATERAL (
			SELECT received_at
			FROM runtime_logs
			ORDER BY received_at DESC, id DESC
			LIMIT 1
		) AS newest ON TRUE
		WHERE usage.singleton = TRUE
	`).Scan(&usage.Records, &usage.PayloadBytes, &oldest, &newest)
	if err != nil {
		return domainlog.Usage{}, fmt.Errorf("read runtime log usage: %w", err)
	}
	if oldest.Valid {
		instant := oldest.Time.UTC()
		usage.OldestReceivedAt = &instant
	}
	if newest.Valid {
		instant := newest.Time.UTC()
		usage.NewestReceivedAt = &instant
	}
	return usage, nil
}

func (s *Store) RotateBatch(ctx context.Context, policy domainlog.Policy, cutoff time.Time, limit int) (int64, error) {
	result, err := s.db.ExecContext(ctx, `
		WITH state AS MATERIALIZED (
			SELECT GREATEST(records - $2, 0) AS excess_records,
			       GREATEST(payload_bytes - $3, 0) AS excess_bytes
			FROM runtime_log_usage
			WHERE singleton = TRUE
		), expired AS MATERIALIZED (
			SELECT id
			FROM runtime_logs
			WHERE received_at < $1
			ORDER BY received_at ASC, id ASC
			LIMIT $4
		), oldest AS MATERIALIZED (
			SELECT id, payload_bytes
			FROM runtime_logs
			ORDER BY id ASC
			LIMIT $4
		), capacity_candidates AS MATERIALIZED (
			SELECT id,
			       payload_bytes,
			       ROW_NUMBER() OVER (ORDER BY id ASC) AS ordinal,
			       SUM(payload_bytes) OVER (ORDER BY id ASC ROWS UNBOUNDED PRECEDING) AS cumulative_bytes
			FROM oldest
		), doomed AS MATERIALIZED (
			SELECT id
			FROM expired
			UNION ALL
			SELECT candidate.id
			FROM capacity_candidates AS candidate
			CROSS JOIN state
			WHERE NOT EXISTS (SELECT 1 FROM expired)
			  AND (
				candidate.ordinal <= state.excess_records
				OR (
					state.excess_bytes > 0
					AND candidate.cumulative_bytes - candidate.payload_bytes < state.excess_bytes
				)
			  )
		)
		DELETE FROM runtime_logs AS logs
		USING doomed
		WHERE logs.id = doomed.id
	`, cutoff, policy.MaxRecords, policy.MaxBytes, limit)
	if err != nil {
		return 0, fmt.Errorf("rotate runtime logs: %w", err)
	}
	deleted, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("read rotated runtime log count: %w", err)
	}
	return deleted, nil
}
