/** 代码执行相关类型 */

/** 单次执行的资源限制（作者可在围栏 info string 声明覆盖） */
export interface ResourceLimits {
	cpu_cores?: number;
	memory_mb?: number;
	timeout_secs?: number;
	output_bytes?: number;
	allow_network?: boolean;
}

/** 提交执行请求 */
export interface ExecRequest {
	language: string;
	source: string;
	overrides?: ResourceLimits;
}

/** 执行状态 */
export type ExecStatus =
	| "queued"
	| "running"
	| "success"
	| "error"
	| "timeout"
	| "oom_killed"
	| "failed";

/** 执行结果（轮询返回 / done 事件载荷） */
export interface ExecResult {
	status: ExecStatus;
	stdout: string;
	stderr: string;
	exit_code?: number | null;
	duration_ms: number;
	language: string;
}

/** 轮询查询的任务视图 */
export interface ExecTask {
	id: string;
	language: string;
	status: ExecStatus;
	stdout: string;
	stderr: string;
	exit_code?: number | null;
	duration_ms: number;
}

/** SSE 流式输出的单个 chunk */
export interface StreamChunk {
	/** "stdout" | "stderr" | "done" */
	type: "stdout" | "stderr" | "done";
	/** stdout/stderr 为文本片段；done 为 ExecResult 的 JSON 字符串 */
	data: string;
}

/** 是否终态（任务结束，停止轮询/SSE） */
export function isTerminalStatus(status: ExecStatus): boolean {
	return (
		status === "success" ||
		status === "error" ||
		status === "timeout" ||
		status === "oom_killed" ||
		status === "failed"
	);
}
