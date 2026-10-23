/** 当前实例的运行策略视图；保存版本不代表所有实例已经应用。 */
export interface RuntimePolicyView<T> {
	/** 最近读取的保存版本；0 表示尚无显式覆盖。 */
	version: number;
	/** 保存覆盖与当前部署默认合并后的值，不保证已经应用。 */
	values: T;
	defaults: T;
	/** 字段路径来源；限流路径为 rules.<id>.<field>。 */
	sources: Record<string, "override" | "deployment" | "application">;
	runtime: RuntimePolicyState<T>;
	presets: RuntimePolicyPreset<T>[];
	entries?: RateLimitEntry[];
	cleanup?: ImageCacheMaintenance;
}

export interface ImageCacheMaintenance {
	/** UTC RFC 3339 时间；尚未开始维护时为 null。 */
	last_started_at: string | null;
	/** UTC RFC 3339 时间；尚未结束维护时为 null。 */
	last_finished_at: string | null;
	removed_entries: number;
	removed_bytes: number;
	remaining_bytes: number;
	error?: string;
	running: boolean;
}

/** 当前请求所到实例的实际策略。 */
export interface RuntimePolicyState<T> {
	/** 当前实例实际应用版本，可能落后于保存版本。 */
	version: number;
	values: T;
	/** stale 表示读取失败，failed 表示校验或准备失败；两者都保留最近有效值。 */
	status: "applied" | "stale" | "failed";
	/** 仅影响后续请求、任务或浏览器调度，不追改在途工作。 */
	activation: "new_requests" | "new_tasks" | "browser_scheduling";
	instance_id: string;
	applied_at: string;
	last_checked_at: string;
	error?: string;
}

/** 预设值来自服务端，选择不会直接提交。 */
export interface RuntimePolicyPreset<T> {
	id: string;
	label: string;
	description: string;
	values: T;
}
export type RuntimePolicyPatch<T> = T extends RateLimitPolicy
	? { rules?: Record<string, Partial<RateLimitRule>> }
	: Partial<T>;

/** 保存只携带实际修改字段；恢复默认与字段更新互斥。 */
export type RuntimePolicyUpdate<T> =
	| { expected_version: number; values: RuntimePolicyPatch<T>; reset?: never }
	| { expected_version: number; reset: true; values?: never };

export interface RateLimitRule {
	enabled: boolean;
	window_seconds: number;
	max_requests: number;
	/** 额外的一秒突发上限；0 表示关闭此维度。 */
	burst_requests: number;
	/** UTC 自然日配额；0 表示关闭日限额，但服务端仍累计获准请求。 */
	daily_quota: number;
	/** Redis 不可用时放行或拒绝；不把故障伪装成可计算的 429 等待。 */
	failure_mode: "allow" | "deny";
}

export interface RateLimitPolicy {
	rules: Record<string, RateLimitRule>;
}

export interface RateLimitEntry {
	id: string;
	title: string;
	description: string;
	identity: string;
	endpoints: string[];
}

export interface ImagePolicy {
	memory_max_entries: number;
	memory_max_bytes: number;
	memory_ttl_seconds: number;
	disk_max_bytes: number;
	disk_ttl_seconds: number;
	cleanup_interval_seconds: number;
	max_source_dimension: number;
	max_source_pixels: number;
	thumbnail_width: number;
	/** JPEG 缩略图质量，范围 1–100；透明图片改用 PNG 保留 alpha。 */
	thumbnail_quality: number;
	webp_mode: "lossless" | "lossy";
	/** 范围 1–100；无损模式下影响编码速度与压缩率，不降低像素精度。 */
	webp_quality: number;
	/** 编码强度 0–6，数值越大通常越耗时。 */
	webp_method: number;
	max_concurrent: number;
	encode_timeout_seconds: number;
	max_input_bytes: number;
	max_output_bytes: number;
}

export interface UploadQueuePolicy {
	max_concurrent_files: number;
}

export interface CodeRunnerPolicy {
	enabled: boolean;
	max_cpu_cores: number;
	/** 实际单位为 MiB（1024² 字节）。 */
	max_memory_mb: number;
	max_timeout_secs: number;
	max_output_bytes: number;
	max_source_bytes: number;
	/** 还需作者声明与语言许可同时允许；不是独立的联网授权。 */
	allow_network: boolean;
	max_concurrent: number;
	queue_timeout_secs: number;
	/** 从任务完成时起算的保留秒数；旧任务维持提交时的值。 */
	task_ttl_secs: number;
	/** canonical 语言白名单；空数组表示禁止全部语言。 */
	languages: string[];
}

export interface UploadQueuePolicyProjection extends UploadQueuePolicy {
	version: number;
}

export interface CodeRunnerPolicyProjection {
	version: number;
	enabled: boolean;
	/** 空数组表示禁止全部语言，而不是使用默认白名单。 */
	languages: string[];
}
