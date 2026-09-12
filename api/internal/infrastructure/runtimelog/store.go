package runtimelog

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	domainlog "blog-api/internal/domain/runtimelog"
)

type Store struct{ db *sql.DB }

func NewStore(db *sql.DB) *Store { return &Store{db: db} }

func (s *Store) Append(ctx context.Context, entries []domainlog.Entry) error {
	if len(entries) == 0 {
		return nil
	}
	var query strings.Builder
	query.WriteString("INSERT INTO runtime_logs (occurred_at,received_at,level,source,message,request_id,trace_id) VALUES ")
	args := make([]any, 0, len(entries)*7)
	for i, entry := range entries {
		if i > 0 {
			query.WriteByte(',')
		}
		base := i * 7
		fmt.Fprintf(&query, "($%d,$%d,$%d,$%d,$%d,$%d,$%d)", base+1, base+2, base+3, base+4, base+5, base+6, base+7)
		args = append(args, entry.OccurredAt, entry.ReceivedAt, entry.Level, entry.Source, entry.Message, entry.RequestID, entry.TraceID)
	}
	_, err := s.db.ExecContext(ctx, query.String(), args...)
	if err != nil {
		return fmt.Errorf("persist runtime log batch: %w", err)
	}
	return nil
}

var likeEscape = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

func (s *Store) ReadPage(ctx context.Context, filter domainlog.Filter) (domainlog.Bounds, []domainlog.Entry, error) {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return domainlog.Bounds{}, nil, fmt.Errorf("begin runtime log page snapshot: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	bounds, err := readBounds(ctx, tx)
	if err != nil {
		return domainlog.Bounds{}, nil, err
	}
	filter.Through = bounds.Newest
	entries := make([]domainlog.Entry, 0, filter.Limit)
	if err := walk(ctx, tx, filter, func(entry domainlog.Entry) error {
		entries = append(entries, entry)
		return nil
	}); err != nil {
		return domainlog.Bounds{}, nil, err
	}
	if err := tx.Commit(); err != nil {
		return domainlog.Bounds{}, nil, fmt.Errorf("commit runtime log page snapshot: %w", err)
	}
	return bounds, entries, nil
}

func (s *Store) Walk(ctx context.Context, filter domainlog.Filter, visit func(domainlog.Entry) error) error {
	return walk(ctx, s.db, filter, visit)
}

type queryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func walk(ctx context.Context, db queryer, filter domainlog.Filter, visit func(domainlog.Entry) error) error {
	query, args := buildReadQuery(filter)
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("read runtime logs: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var entry domainlog.Entry
		if err := rows.Scan(&entry.ID, &entry.OccurredAt, &entry.ReceivedAt, &entry.Level, &entry.Source, &entry.Message, &entry.RequestID, &entry.TraceID); err != nil {
			return err
		}
		if err := visit(entry); err != nil {
			return err
		}
	}
	return rows.Err()
}

func buildReadQuery(filter domainlog.Filter) (string, []any) {
	var query strings.Builder
	query.WriteString("SELECT id,occurred_at,received_at,level,source,message,request_id,trace_id FROM runtime_logs WHERE true")
	args := make([]any, 0, 12)
	add := func(expression string, value any) {
		args = append(args, value)
		query.WriteString(" AND " + expression + " $" + strconv.Itoa(len(args)))
	}
	if len(filter.Levels) > 0 {
		query.WriteString(" AND level IN (")
		for i, level := range filter.Levels {
			if i > 0 {
				query.WriteByte(',')
			}
			args = append(args, level)
			query.WriteString("$" + strconv.Itoa(len(args)))
		}
		query.WriteByte(')')
	}
	if filter.Source != "" {
		add("source =", filter.Source)
	}
	if filter.Keyword != "" {
		add("message ILIKE", "%"+likeEscape.Replace(filter.Keyword)+"%")
	}
	if filter.RequestID != "" {
		add("request_id =", filter.RequestID)
	}
	if filter.TraceID != "" {
		add("trace_id =", filter.TraceID)
	}
	if !filter.From.IsZero() {
		add("occurred_at >=", filter.From)
	}
	if !filter.Until.IsZero() {
		add("occurred_at <", filter.Until)
	}
	if filter.Before > 0 {
		add("id <", filter.Before)
	}
	if filter.After > 0 {
		add("id >", filter.After)
	}
	if filter.Through > 0 {
		add("id <=", filter.Through)
	}
	if filter.Ascending {
		query.WriteString(" ORDER BY id ASC")
	} else {
		query.WriteString(" ORDER BY id DESC")
	}
	args = append(args, filter.Limit)
	query.WriteString(" LIMIT $" + strconv.Itoa(len(args)))
	return query.String(), args
}

func (s *Store) Bounds(ctx context.Context) (domainlog.Bounds, error) {
	return readBounds(ctx, s.db)
}

func readBounds(ctx context.Context, db queryer) (domainlog.Bounds, error) {
	var bounds domainlog.Bounds
	err := db.QueryRowContext(ctx, `
		SELECT COALESCE(oldest.id, 0), usage.high_watermark
		FROM runtime_log_usage AS usage
		LEFT JOIN LATERAL (
			SELECT id
			FROM runtime_logs
			ORDER BY id ASC
			LIMIT 1
		) AS oldest ON TRUE
		WHERE usage.singleton = TRUE
	`).Scan(&bounds.Oldest, &bounds.Newest)
	if err != nil {
		return domainlog.Bounds{}, fmt.Errorf("read runtime log bounds: %w", err)
	}
	return bounds, nil
}
