package system

import (
	"context"
	"io"
	"time"
)

const (
	BackupOriginManual = "manual"
	BackupOriginAuto   = "auto"
	BackupOriginImport = "import"
)

// DatabaseOperations 定义数据库诊断、SQL 与导出的基础设施端口。
type DatabaseOperations interface {
	GetDatabaseStatus(ctx context.Context) (*DatabaseStatus, error)
	GetSchema(ctx context.Context) (*DatabaseSchema, error)
	ExecuteSQL(ctx context.Context, input ExecuteSQLInput) (*SQLResult, error)
	Export(ctx context.Context, input ExportInput) (io.ReadCloser, ExportMetadata, error)
}

// BackupOperations 定义备份文件与 PostgreSQL 工具的基础设施端口。
type BackupOperations interface {
	List(ctx context.Context) ([]BackupInfo, error)
	Create(ctx context.Context, origin string, includeUploads bool, progress ProgressReporter) (*BackupInfo, error)
	Import(ctx context.Context, filename string, src io.Reader, maxBytes int64) (*BackupInfo, error)
	Restore(ctx context.Context, filename string, progress ProgressReporter) error
	Delete(ctx context.Context, filename string) error
	Open(ctx context.Context, filename, part string) (io.ReadCloser, BackupDownload, error)
	RotateAuto(ctx context.Context, keep int) error
}

// SettingsStore 是自动备份设置使用的键值存储端口。
type SettingsStore interface {
	GetAll(ctx context.Context) (map[string]string, error)
	UpsertMany(ctx context.Context, kvs map[string]string) error
}

// ProgressReporter 上报长任务进度，progress 范围为 0–100。
type ProgressReporter func(message string, progress int)

// DatabaseStatus 聚合 PostgreSQL 运行状态。
type DatabaseStatus struct {
	CollectedAt      time.Time          `json:"collected_at"`
	DatabaseSize     int64              `json:"database_size"`
	TotalConnections int                `json:"total_connections"`
	MaxConnections   int                `json:"max_connections"`
	TableCount       int                `json:"table_count"`
	Migration        MigrationStatus    `json:"migration"`
	Pool             PoolStats          `json:"pool"`
	Tables           []DatabaseTable    `json:"tables"`
	TopIndexes       []DatabaseIndex    `json:"top_indexes"`
	ActiveQueries    []DatabaseActivity `json:"active_queries"`
}

// MigrationStatus 描述 golang-migrate 当前版本和 dirty 状态。
type MigrationStatus struct {
	Version uint64 `json:"version"`
	Dirty   bool   `json:"dirty"`
}

// DatabaseTable 描述一张用户表的统计信息。
type DatabaseTable struct {
	Schema          string     `json:"schema"`
	Name            string     `json:"name"`
	EstimatedRows   int64      `json:"estimated_rows"`
	TableSize       int64      `json:"table_size"`
	IndexSize       int64      `json:"index_size"`
	TotalSize       int64      `json:"total_size"`
	DeadTuples      int64      `json:"dead_tuples"`
	LastVacuum      *time.Time `json:"last_vacuum"`
	LastAnalyze     *time.Time `json:"last_analyze"`
	StatisticsFresh bool       `json:"statistics_fresh"`
}

// DatabaseIndex 描述索引使用和占用信息。
type DatabaseIndex struct {
	Schema     string `json:"schema"`
	Table      string `json:"table"`
	Name       string `json:"name"`
	Scans      int64  `json:"scans"`
	TuplesRead int64  `json:"tuples_read"`
	Size       int64  `json:"size"`
}

// DatabaseActivity 描述一条非空 PostgreSQL 活动查询。
type DatabaseActivity struct {
	PID             int        `json:"pid"`
	User            string     `json:"user"`
	State           string     `json:"state"`
	WaitEventType   string     `json:"wait_event_type"`
	WaitEvent       string     `json:"wait_event"`
	QueryStartedAt  *time.Time `json:"query_started_at"`
	DurationSeconds float64    `json:"duration_seconds"`
	Query           string     `json:"query"`
}

// DatabaseSchema 是 SQL 补全、导出表选择与关系图使用的 schema 视图。
type DatabaseSchema struct {
	Tables        []SchemaTable        `json:"tables"`
	Relationships []SchemaRelationship `json:"relationships"`
}

// SchemaTable 描述一张表及其列。
type SchemaTable struct {
	Schema  string         `json:"schema"`
	Name    string         `json:"name"`
	Columns []SchemaColumn `json:"columns"`
}

// SchemaColumn 描述列名、数据库类型和可空性。
type SchemaColumn struct {
	Name     string `json:"name"`
	DataType string `json:"data_type"`
	Nullable bool   `json:"nullable"`
}

// SchemaRelationship 描述一条外键约束及其列映射。
type SchemaRelationship struct {
	Name          string   `json:"name"`
	SourceSchema  string   `json:"source_schema"`
	SourceTable   string   `json:"source_table"`
	SourceColumns []string `json:"source_columns"`
	TargetSchema  string   `json:"target_schema"`
	TargetTable   string   `json:"target_table"`
	TargetColumns []string `json:"target_columns"`
	// OnUpdate 是 PostgreSQL 外键更新动作，如 CASCADE 或 NO ACTION。
	OnUpdate string `json:"on_update"`
	// OnDelete 是 PostgreSQL 外键删除动作，如 CASCADE 或 NO ACTION。
	OnDelete string `json:"on_delete"`
}

// ExecuteSQLInput 是 SQL 控制台执行参数。
type ExecuteSQLInput struct {
	SQL              string `json:"sql"`
	AllowMulti       bool   `json:"allow_multi"`
	ConfirmDangerous bool   `json:"confirm_dangerous"`
	WithExplain      bool   `json:"with_explain"`
}

// SQLResult 是 SQL 控制台的可观察执行结果。
type SQLResult struct {
	Columns       []string `json:"columns"`
	Rows          [][]any  `json:"rows"`
	AffectedRows  int64    `json:"affected_rows"`
	ElapsedMS     int64    `json:"elapsed_ms"`
	StatementType string   `json:"statement_type"`
	Truncated     bool     `json:"truncated"`
}

// ExportInput 是数据导出参数。
type ExportInput struct {
	// Source 取值为 table 或 query。
	Source string `json:"source"`
	Schema string `json:"schema"`
	Table  string `json:"table"`
	Query  string `json:"query"`
	// Format 取值为 csv 或 sql。
	Format         string `json:"format"`
	IncludeColumns bool   `json:"include_columns"`
}

// ExportMetadata 描述下载响应头所需信息。
type ExportMetadata struct {
	Filename    string
	ContentType string
}

// BackupInfo 描述一个完成的数据库备份及可选上传归档。
type BackupInfo struct {
	Filename string `json:"filename"`
	// Origin 取值为 manual、auto 或 import。
	Origin          string    `json:"origin"`
	CreatedAt       time.Time `json:"created_at"`
	Size            int64     `json:"size"`
	UploadsFilename string    `json:"uploads_filename,omitempty"`
	UploadsSize     int64     `json:"uploads_size,omitempty"`
	// DatabaseTool 记录创建或导入时的 PostgreSQL 客户端版本。
	DatabaseTool string `json:"database_tool"`
}

// BackupDownload 描述备份下载响应。
type BackupDownload struct {
	Filename    string
	ContentType string
	Size        int64
}

// BackupSettings 是自动备份的持久化配置。
type BackupSettings struct {
	AutoEnabled bool `json:"auto_enabled"`
	// TimeUTC 使用 24 小时制 HH:mm 格式。
	TimeUTC        string `json:"time_utc"`
	RetentionCount int    `json:"retention_count"`
	IncludeUploads bool   `json:"include_uploads"`
}

// BackupRunResult 描述最近一次自动备份结果。
type BackupRunResult struct {
	At       time.Time `json:"at"`
	OK       bool      `json:"ok"`
	Filename string    `json:"filename,omitempty"`
	Error    string    `json:"error,omitempty"`
}

// BackupSettingsView 补充自动备份的下次执行与最近结果。
type BackupSettingsView struct {
	BackupSettings
	NextRunAt *time.Time       `json:"next_run_at,omitempty"`
	LastRun   *BackupRunResult `json:"last_run,omitempty"`
}

// BackupListResponse 聚合备份列表与调度设置。
type BackupListResponse struct {
	Backups  []BackupInfo       `json:"backups"`
	Settings BackupSettingsView `json:"settings"`
}

// BackupTask 描述备份或恢复异步任务。
type BackupTask struct {
	ID string `json:"id"`
	// Kind 取值为 backup 或 restore。
	Kind string `json:"kind"`
	// Status 取值为 running、succeeded 或 failed。
	Status     string     `json:"status"`
	Message    string     `json:"message"`
	Progress   int        `json:"progress"`
	Error      string     `json:"error,omitempty"`
	ResultFile string     `json:"result_file,omitempty"`
	StartedAt  time.Time  `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
}
