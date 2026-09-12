export type RuntimeLogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "panic";

export interface RuntimeLogEntry {
	id: string;
	occurred_at: string;
	received_at: string;
	level: RuntimeLogLevel;
	source: string;
	message: string;
	request_id?: string;
	trace_id?: string;
}

export interface RuntimeLogFilter {
	levels?: RuntimeLogLevel[];
	source?: string;
	keyword?: string;
	request_id?: string;
	trace_id?: string;
	/** RFC3339，包含此时刻。 */
	from?: string;
	/** RFC3339，不包含此时刻。 */
	until?: string;
}

export interface RuntimeLogPage {
	items: RuntimeLogEntry[];
	next_cursor: string;
	oldest_cursor: string;
	newest_cursor: string;
	has_more: boolean;
	gap: boolean;
}

export interface RuntimeLogStreamStatus {
	active: number;
	capacity: number;
	batch_limit: number;
	poll_interval_ms: number;
	opened: number;
	capacity_rejected: number;
	read_failures: number;
	write_failures: number;
	access_revocations: number;
}

export interface RuntimeLogExportStatus {
	active: number;
	capacity: number;
	record_limit: number;
	byte_limit: number;
	completed: number;
	failed: number;
	cancelled: number;
	capacity_rejected: number;
}

export interface RuntimeLogStatus {
	enabled: boolean;
	initialization_failed: boolean;
	accepted: number;
	persisted: number;
	queue_overflow: number;
	persistence_failed: number;
	shutdown_dropped: number;
	malformed: number;
	oversized: number;
	queued: number;
	capacity: number;
	last_failure: string | null;
	/** zerolog 最低采集级别；标准库日志按 INFO 收录。 */
	minimum_level: string;
	observed_at: string;
	delivery: {
		stream: RuntimeLogStreamStatus;
		export: RuntimeLogExportStatus;
	};
}

export interface RuntimeLogPolicy {
	version: number;
	retention_days: number;
	max_records: number;
	/** 日志字段估算字节数上限，不含 PostgreSQL 索引页。 */
	max_bytes: number;
	updated_at: string;
}

export interface RuntimeLogUsage {
	records: number;
	/** 当前日志字段估算字节数，不含 PostgreSQL 索引页。 */
	payload_bytes: number;
	oldest_received_at: string | null;
	newest_received_at: string | null;
}

export interface RuntimeLogPolicyLimits {
	retention_days_min: number;
	retention_days_max: number;
	max_records_min: number;
	max_records_max: number;
	max_bytes_min: number;
	max_bytes_max: number;
}

export interface RuntimeLogRotationStatus {
	running: boolean;
	next_run_at: string;
	last_started_at: string | null;
	last_finished_at: string | null;
	last_deleted: number;
	last_error?: string;
	last_policy_version: number;
	/** 仅在轮转读取完策略后存在。 */
	active_policy_version?: number;
	remaining_over_limit: boolean;
}

export interface RuntimeLogMaintenance {
	policy: RuntimeLogPolicy;
	usage: RuntimeLogUsage;
	limits: RuntimeLogPolicyLimits;
	rotation: RuntimeLogRotationStatus;
}

export interface UpdateRuntimeLogPolicyInput {
	expected_version: number;
	retention_days: number;
	max_records: number;
	max_bytes: number;
}

export interface RuntimeLogPolicyUpdate {
	policy: RuntimeLogPolicy;
	rotation: RuntimeLogRotationStatus;
}

export interface RuntimeLogRotationResult {
	result: {
		deleted: number;
		remaining_over_limit: boolean;
	};
	rotation: RuntimeLogRotationStatus;
}
