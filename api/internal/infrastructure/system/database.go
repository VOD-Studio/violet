package system

import (
	"context"
	"database/sql"
	"time"

	appsystem "blog-api/internal/application/system"
)

// Database 实现系统面板的 PostgreSQL 诊断、SQL 与导出端口。
type Database struct {
	db *sql.DB
}

// NewDatabase 构造 PostgreSQL 系统面板适配器。
func NewDatabase(db *sql.DB) *Database {
	return &Database{db: db}
}

// GetDatabaseStatus 聚合当前数据库的只读统计视图。
func (d *Database) GetDatabaseStatus(ctx context.Context) (*appsystem.DatabaseStatus, error) {
	status := &appsystem.DatabaseStatus{CollectedAt: time.Now().UTC()}
	if err := d.db.QueryRowContext(ctx, `
		SELECT pg_database_size(current_database()),
		       count(*)::int,
		       (SELECT setting::int FROM pg_settings WHERE name = 'max_connections')
		FROM pg_stat_activity
		WHERE datname = current_database()
	`).Scan(&status.DatabaseSize, &status.TotalConnections, &status.MaxConnections); err != nil {
		return nil, err
	}

	if err := d.db.QueryRowContext(ctx, `SELECT version, dirty FROM schema_migrations LIMIT 1`).
		Scan(&status.Migration.Version, &status.Migration.Dirty); err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	tableRows, err := d.db.QueryContext(ctx, `
		SELECT schemaname,
		       relname,
		       COALESCE(n_live_tup, 0)::bigint,
		       pg_relation_size(relid),
		       pg_indexes_size(relid),
		       pg_total_relation_size(relid),
		       COALESCE(n_dead_tup, 0)::bigint,
		       COALESCE(last_vacuum, last_autovacuum),
		       COALESCE(last_analyze, last_autoanalyze),
		       COALESCE(COALESCE(last_analyze, last_autoanalyze) > clock_timestamp() - INTERVAL '7 days', FALSE)
		FROM pg_stat_user_tables
		ORDER BY pg_total_relation_size(relid) DESC, schemaname, relname
	`)
	if err != nil {
		return nil, err
	}
	defer tableRows.Close()
	for tableRows.Next() {
		var item appsystem.DatabaseTable
		var lastVacuum, lastAnalyze sql.NullTime
		if err := tableRows.Scan(
			&item.Schema,
			&item.Name,
			&item.EstimatedRows,
			&item.TableSize,
			&item.IndexSize,
			&item.TotalSize,
			&item.DeadTuples,
			&lastVacuum,
			&lastAnalyze,
			&item.StatisticsFresh,
		); err != nil {
			return nil, err
		}
		if lastVacuum.Valid {
			value := lastVacuum.Time
			item.LastVacuum = &value
		}
		if lastAnalyze.Valid {
			value := lastAnalyze.Time
			item.LastAnalyze = &value
		}
		status.Tables = append(status.Tables, item)
	}
	if err := tableRows.Err(); err != nil {
		return nil, err
	}
	status.TableCount = len(status.Tables)

	indexRows, err := d.db.QueryContext(ctx, `
		SELECT s.schemaname,
		       s.relname,
		       s.indexrelname,
		       s.idx_scan,
		       s.idx_tup_read,
		       pg_relation_size(s.indexrelid)
		FROM pg_stat_user_indexes s
		ORDER BY pg_relation_size(s.indexrelid) DESC
		LIMIT 20
	`)
	if err != nil {
		return nil, err
	}
	defer indexRows.Close()
	for indexRows.Next() {
		var item appsystem.DatabaseIndex
		if err := indexRows.Scan(&item.Schema, &item.Table, &item.Name, &item.Scans, &item.TuplesRead, &item.Size); err != nil {
			return nil, err
		}
		status.TopIndexes = append(status.TopIndexes, item)
	}
	if err := indexRows.Err(); err != nil {
		return nil, err
	}

	activityRows, err := d.db.QueryContext(ctx, `
		SELECT pid,
		       COALESCE(usename, ''),
		       COALESCE(state, ''),
		       COALESCE(wait_event_type, ''),
		       COALESCE(wait_event, ''),
		       query_start,
		       COALESCE(EXTRACT(EPOCH FROM clock_timestamp() - query_start), 0)::double precision,
		       LEFT(query, 1000)
		FROM pg_stat_activity
		WHERE datname = current_database()
		  AND pid <> pg_backend_pid()
		  AND state <> 'idle'
		ORDER BY query_start ASC NULLS LAST
		LIMIT 50
	`)
	if err != nil {
		return nil, err
	}
	defer activityRows.Close()
	for activityRows.Next() {
		var item appsystem.DatabaseActivity
		var startedAt sql.NullTime
		if err := activityRows.Scan(
			&item.PID,
			&item.User,
			&item.State,
			&item.WaitEventType,
			&item.WaitEvent,
			&startedAt,
			&item.DurationSeconds,
			&item.Query,
		); err != nil {
			return nil, err
		}
		if startedAt.Valid {
			value := startedAt.Time
			item.QueryStartedAt = &value
		}
		status.ActiveQueries = append(status.ActiveQueries, item)
	}
	if err := activityRows.Err(); err != nil {
		return nil, err
	}

	status.Tables = nonNil(status.Tables)
	status.TopIndexes = nonNil(status.TopIndexes)
	status.ActiveQueries = nonNil(status.ActiveQueries)
	return status, nil
}

// GetSchema 返回 public 用户表及列，供编辑器补全和导出白名单使用。
func (d *Database) GetSchema(ctx context.Context) (*appsystem.DatabaseSchema, error) {
	rows, err := d.db.QueryContext(ctx, `
		SELECT table_schema, table_name, column_name, data_type, is_nullable = 'YES'
		FROM information_schema.columns
		WHERE table_schema = 'public'
		ORDER BY table_schema, table_name, ordinal_position
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := &appsystem.DatabaseSchema{Tables: []appsystem.SchemaTable{}}
	var current *appsystem.SchemaTable
	for rows.Next() {
		var schema, table string
		var column appsystem.SchemaColumn
		if err := rows.Scan(&schema, &table, &column.Name, &column.DataType, &column.Nullable); err != nil {
			return nil, err
		}
		if current == nil || current.Schema != schema || current.Name != table {
			result.Tables = append(result.Tables, appsystem.SchemaTable{
				Schema: schema, Name: table, Columns: []appsystem.SchemaColumn{},
			})
			current = &result.Tables[len(result.Tables)-1]
		}
		current.Columns = append(current.Columns, column)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func nonNil[T any](items []T) []T {
	if items == nil {
		return []T{}
	}
	return items
}
