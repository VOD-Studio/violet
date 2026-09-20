package system

import (
	"bufio"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	appsystem "blog-api/internal/application/system"
	domainshared "blog-api/internal/domain/shared"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"
)

const (
	sqlTimeout     = 30 * time.Second
	maxResultRows  = 500
	maxResultBytes = 2 << 20
)

// ExecuteSQL 在受控事务中执行 SQL，并限制时间、结果行数与响应体积。
func (d *Database) ExecuteSQL(ctx context.Context, input appsystem.ExecuteSQLInput) (*appsystem.SQLResult, error) {
	statements, err := analyzeSQL(input.SQL, input.AllowMulti, input.ConfirmDangerous)
	if err != nil {
		return nil, err
	}
	if input.WithExplain {
		if len(statements) != 1 || !statements[0].readOnly {
			return nil, domainshared.BadRequest("EXPLAIN 仅支持单条只读查询")
		}
		if !strings.HasPrefix(statements[0].kind, "explain") {
			statements[0].sql = "EXPLAIN (FORMAT JSON) " + statements[0].sql
			statements[0].kind = "explain"
		}
	}

	readOnly := true
	for _, statement := range statements {
		if !statement.readOnly {
			readOnly = false
			break
		}
	}

	execCtx, cancel := context.WithTimeout(ctx, sqlTimeout)
	defer cancel()
	started := time.Now()
	tx, err := d.db.BeginTx(execCtx, &sql.TxOptions{ReadOnly: readOnly})
	if err != nil {
		return nil, postgresError(err)
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(execCtx, `SET LOCAL statement_timeout = '30s'`); err != nil {
		return nil, postgresError(err)
	}

	result := &appsystem.SQLResult{Columns: []string{}, Rows: [][]any{}}
	for _, statement := range statements {
		result.Columns = []string{}
		result.Rows = [][]any{}
		result.Truncated = false
		result.StatementType = statementTypeLabel(statement.kind)
		if statement.readOnly || hasTopLevelToken(statement.tokens, "returning") {
			rows, queryErr := tx.QueryContext(execCtx, statement.sql)
			if queryErr != nil {
				return nil, postgresError(queryErr)
			}
			columns, values, truncated, readErr := readSQLRows(rows)
			if readErr != nil {
				return nil, postgresError(readErr)
			}
			result.Columns = columns
			result.Rows = values
			result.Truncated = truncated
			continue
		}
		command, execErr := tx.ExecContext(execCtx, statement.sql)
		if execErr != nil {
			return nil, postgresError(execErr)
		}
		if affected, affectedErr := command.RowsAffected(); affectedErr == nil {
			result.AffectedRows += affected
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, postgresError(err)
	}
	result.ElapsedMS = time.Since(started).Milliseconds()
	return result, nil
}

// Export 打开流式 CSV 或 SQL INSERT 下载。
func (d *Database) Export(ctx context.Context, input appsystem.ExportInput) (io.ReadCloser, appsystem.ExportMetadata, error) {
	format := strings.ToLower(strings.TrimSpace(input.Format))
	if format != "csv" && format != "sql" {
		return nil, appsystem.ExportMetadata{}, domainshared.BadRequest("导出格式必须是 csv 或 sql")
	}

	query, target, err := d.exportQuery(ctx, input)
	if err != nil {
		return nil, appsystem.ExportMetadata{}, err
	}
	exportCtx, cancel := context.WithTimeout(ctx, sqlTimeout)
	tx, err := d.db.BeginTx(exportCtx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		cancel()
		return nil, appsystem.ExportMetadata{}, postgresError(err)
	}
	if _, err := tx.ExecContext(exportCtx, `SET LOCAL statement_timeout = '30s'`); err != nil {
		_ = tx.Rollback()
		cancel()
		return nil, appsystem.ExportMetadata{}, postgresError(err)
	}
	rows, err := tx.QueryContext(exportCtx, query)
	if err != nil {
		_ = tx.Rollback()
		cancel()
		return nil, appsystem.ExportMetadata{}, postgresError(err)
	}

	reader, writer := io.Pipe()
	go func() {
		defer cancel()
		defer rows.Close()
		var streamErr error
		if format == "csv" {
			streamErr = writeCSVExport(writer, rows, input.IncludeColumns)
		} else {
			streamErr = writeSQLExport(writer, rows, target, input.IncludeColumns)
		}
		if streamErr == nil {
			streamErr = tx.Commit()
		} else {
			_ = tx.Rollback()
		}
		_ = writer.CloseWithError(streamErr)
	}()

	timestamp := time.Now().UTC().Format("20060102_150405")
	metadata := appsystem.ExportMetadata{
		Filename: "violet_export_" + timestamp + "." + format,
		ContentType: map[string]string{
			"csv": "text/csv; charset=utf-8",
			"sql": "application/sql; charset=utf-8",
		}[format],
	}
	return reader, metadata, nil
}

func (d *Database) exportQuery(ctx context.Context, input appsystem.ExportInput) (query, target string, err error) {
	switch input.Source {
	case "table":
		schema := strings.TrimSpace(input.Schema)
		table := strings.TrimSpace(input.Table)
		if !simpleIdentifier(schema) || !simpleIdentifier(table) {
			return "", "", domainshared.BadRequest("无效的 schema 或表名")
		}
		var exists bool
		if err := d.db.QueryRowContext(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM information_schema.tables
				WHERE table_schema = $1 AND table_name = $2 AND table_type = 'BASE TABLE'
			)
		`, schema, table).Scan(&exists); err != nil {
			return "", "", err
		}
		if !exists {
			return "", "", domainshared.NotFound("数据表")
		}
		target = pq.QuoteIdentifier(schema) + "." + pq.QuoteIdentifier(table)
		return "SELECT * FROM " + target, target, nil
	case "query":
		statement, analyzeErr := analyzeReadOnlySQL(input.Query)
		if analyzeErr != nil {
			return "", "", analyzeErr
		}
		return statement.sql, pq.QuoteIdentifier("export_result"), nil
	default:
		return "", "", domainshared.BadRequest("导出来源必须是 table 或 query")
	}
}

func readSQLRows(rows *sql.Rows) ([]string, [][]any, bool, error) {
	defer rows.Close()
	columns, err := rows.Columns()
	if err != nil {
		return nil, nil, false, err
	}
	types, err := rows.ColumnTypes()
	if err != nil {
		return nil, nil, false, err
	}
	result := make([][]any, 0, min(maxResultRows, 64))
	totalBytes := 0
	truncated := false
	for rows.Next() {
		if len(result) >= maxResultRows {
			truncated = true
			break
		}
		values, scanErr := scanRow(rows, types)
		if scanErr != nil {
			return nil, nil, false, scanErr
		}
		encoded, marshalErr := json.Marshal(values)
		if marshalErr != nil {
			return nil, nil, false, marshalErr
		}
		if totalBytes+len(encoded) > maxResultBytes {
			truncated = true
			break
		}
		totalBytes += len(encoded)
		result = append(result, values)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, false, err
	}
	return columns, result, truncated, nil
}

func writeCSVExport(dst io.Writer, rows *sql.Rows, includeColumns bool) error {
	columns, err := rows.Columns()
	if err != nil {
		return err
	}
	types, err := rows.ColumnTypes()
	if err != nil {
		return err
	}
	writer := csv.NewWriter(dst)
	if includeColumns {
		if err := writer.Write(columns); err != nil {
			return err
		}
	}
	for rows.Next() {
		values, scanErr := scanRow(rows, types)
		if scanErr != nil {
			return scanErr
		}
		record := make([]string, len(values))
		for i, value := range values {
			record[i] = csvValue(value)
		}
		if err := writer.Write(record); err != nil {
			return err
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return err
	}
	return rows.Err()
}

func writeSQLExport(dst io.Writer, rows *sql.Rows, target string, includeColumns bool) error {
	columns, err := rows.Columns()
	if err != nil {
		return err
	}
	types, err := rows.ColumnTypes()
	if err != nil {
		return err
	}
	writer := bufio.NewWriter(dst)
	if _, err := writer.WriteString("-- Violet data export; data only, no schema\n"); err != nil {
		return err
	}
	columnClause := ""
	if includeColumns {
		quoted := make([]string, len(columns))
		for i, column := range columns {
			quoted[i] = pq.QuoteIdentifier(column)
		}
		columnClause = " (" + strings.Join(quoted, ", ") + ")"
	}
	for rows.Next() {
		values, scanErr := scanRawRow(rows)
		if scanErr != nil {
			return scanErr
		}
		quoted := make([]string, len(values))
		for i, value := range values {
			quoted[i] = sqlLiteral(value, types[i].DatabaseTypeName())
		}
		if _, err := fmt.Fprintf(writer, "INSERT INTO %s%s VALUES (%s);\n", target, columnClause, strings.Join(quoted, ", ")); err != nil {
			return err
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return writer.Flush()
}

func scanRow(rows *sql.Rows, types []*sql.ColumnType) ([]any, error) {
	values, err := scanRawRow(rows)
	if err != nil {
		return nil, err
	}
	for i, value := range values {
		values[i] = jsonValue(value, types[i].DatabaseTypeName())
	}
	return values, nil
}

func scanRawRow(rows *sql.Rows) ([]any, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	values := make([]any, len(columns))
	pointers := make([]any, len(values))
	for i := range values {
		pointers[i] = &values[i]
	}
	if err := rows.Scan(pointers...); err != nil {
		return nil, err
	}
	return values, nil
}

func jsonValue(value any, databaseType string) any {
	switch typed := value.(type) {
	case nil, bool, int64, float64, string:
		return typed
	case time.Time:
		return typed.UTC().Format(time.RFC3339Nano)
	case []byte:
		if strings.EqualFold(databaseType, "BYTEA") || !utf8.Valid(typed) {
			return base64.StdEncoding.EncodeToString(typed)
		}
		return string(typed)
	default:
		return fmt.Sprint(typed)
	}
}

func csvValue(value any) string {
	if value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	case time.Time:
		return typed.UTC().Format(time.RFC3339Nano)
	case []byte:
		if utf8.Valid(typed) {
			return string(typed)
		}
		return base64.StdEncoding.EncodeToString(typed)
	default:
		return fmt.Sprint(typed)
	}
}

func sqlLiteral(value any, databaseType string) string {
	if value == nil {
		return "NULL"
	}
	switch typed := value.(type) {
	case bool:
		if typed {
			return "TRUE"
		}
		return "FALSE"
	case int64:
		return strconv.FormatInt(typed, 10)
	case float64:
		return strconv.FormatFloat(typed, 'g', -1, 64)
	case time.Time:
		return pq.QuoteLiteral(typed.UTC().Format(time.RFC3339Nano))
	case []byte:
		if strings.EqualFold(databaseType, "BYTEA") {
			return "decode('" + hex.EncodeToString(typed) + "', 'hex')"
		}
		return pq.QuoteLiteral(string(typed))
	case string:
		return pq.QuoteLiteral(typed)
	default:
		return pq.QuoteLiteral(fmt.Sprint(typed))
	}
}

func statementTypeLabel(kind string) string {
	kind = strings.TrimPrefix(kind, "explain:")
	if kind == "" {
		return "OTHER"
	}
	return strings.ToUpper(kind)
}

func simpleIdentifier(value string) bool {
	if value == "" {
		return false
	}
	for i, ch := range value {
		if ch == '_' || ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || i > 0 && ch >= '0' && ch <= '9' {
			continue
		}
		return false
	}
	return true
}

func postgresError(err error) error {
	if errors.Is(err, context.DeadlineExceeded) {
		return domainshared.BadRequest("SQL 执行超过 30 秒，已取消")
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		message := pgErr.Message
		if pgErr.Detail != "" {
			message += "：" + pgErr.Detail
		}
		return domainshared.BadRequest(message)
	}
	return err
}
