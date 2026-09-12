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
}
