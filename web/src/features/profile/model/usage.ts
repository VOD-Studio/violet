/** UTC 自然日统计窗口，包含今天。 */
export type UsageRange = "7d" | "30d" | "90d";

/** 当前账号的模型用量汇总；成本为 USD API 等价估算，非订阅账单。 */
export interface UsageSummary {
	requests: number;
	errors: number;
	error_rate: number;
	total_tokens: number;
	input_tokens: number;
	output_tokens: number;
	cache_read_tokens: number;
	cache_write_tokens: number;
	reasoning_tokens: number;
	cache_rate: number;
	api_cost_estimate: number;
	avg_duration_ms: number;
	avg_ttft_ms: number;
	avg_tokens_per_second: number;
}

/** 按提供商和模型聚合的用量。 */
export interface UsageModel {
	provider: string;
	model: string;
	requests: number;
	errors: number;
	total_tokens: number;
	input_tokens: number;
	output_tokens: number;
	cache_read_tokens: number;
	cache_write_tokens: number;
	reasoning_tokens: number;
	cache_rate: number;
	cost: number;
	avg_tokens_per_second: number;
	avg_ttft_ms: number;
}

/** 服务端按总 token 降序返回。 */
export interface UsageModels {
	models: UsageModel[];
}

/** UTC 桶起点及该时段的请求量。 */
export interface UsagePoint {
	timestamp: string;
	requests: number;
	errors: number;
	total_tokens: number;
	api_cost_estimate: number;
}

/** 服务端补齐窗口内的空桶，不含未来时段。 */
export interface UsageTimeseries {
	bucket: "day" | "hour";
	points: UsagePoint[];
}
