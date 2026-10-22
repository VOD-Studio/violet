/**
 * ApiError 构造参数
 */
export interface ApiErrorInit {
	/** 机器错误码 */
	error: string;
	/** 人类可读消息 */
	message: string;
	/** HTTP 状态码（网络错误时为 0） */
	status: number;
	/** 字段级校验错误 */
	details?: Record<string, string[]>;
	/** 请求追踪 ID */
	requestId?: string;
	/** 后端错误响应的原始 body（非标准字段透传，如 409 link_confirmation_required 的 link_token） */
	data?: Record<string, unknown>;
	/** 服务端原始 Retry-After 响应头。 */
	retryAfter?: string;
	/** 最早可恢复时间，Unix 毫秒；无有效响应头时不推测。 */
	retryAt?: number;
}

/**
 * ApiError - 归一化的 API 错误
 *
 * httpClient 将 HTTP 响应错误与网络故障归一化为此类型；
 * 主动取消保留原始取消异常，不转换成网络故障。
 *
 * 业务码（与后端 response/error.go 对应）：
 * - UNAUTHORIZED (401)：未登录或 token 失效
 * - FORBIDDEN (403)：权限不足
 * - NOT_FOUND (404)：资源不存在
 * - INTERNAL_ERROR (500)：服务端异常
 * - NETWORK_ERROR (status 0)：网络中断/超时
 */
export class ApiError extends Error {
	/** 机器错误码 */
	readonly code: string;
	/** HTTP 状态码（网络错误时为 0） */
	readonly status: number;
	/** 字段级校验错误 */
	readonly details?: Record<string, string[]>;
	/** 请求追踪 ID */
	readonly requestId?: string;
	/** 后端错误响应原始 body（link_token 等非标准字段从中读取） */
	readonly data?: Record<string, unknown>;
	/** 服务端原始 Retry-After 响应头。 */
	readonly retryAfter?: string;
	/** 本地 Unix 毫秒恢复时刻；undefined 表示没有可信的自动恢复期限。 */
	readonly retryAt?: number;

	constructor(init: ApiErrorInit) {
		super(init.message);
		this.name = "ApiError";
		this.code = init.error;
		this.status = init.status;
		this.details = init.details;
		this.requestId = init.requestId;
		this.data = init.data;
		this.retryAfter = init.retryAfter;
		this.retryAt = init.retryAt;
	}

	/**
	 * network - 网络错误/超时的工厂方法
	 *
	 * status 设为 0 表示非 HTTP 响应（连接失败/超时），
	 * 让上层 retry 判断与 5xx 区分。
	 *
	 * @param message 自定义消息
	 * @returns status=0 的 ApiError
	 */
	static network(message = "网络错误，请检查连接"): ApiError {
		return new ApiError({
			error: "NETWORK_ERROR",
			message,
			status: 0,
		});
	}

	/**
	 * isValidation - 是否为字段校验错误
	 *
	 * 后端返回 422/400 + details 字段时为 true，
	 * 表单组件可据此把 details 映射到字段错误显示。
	 *
	 * @returns 是否带非空 details
	 */
	isValidation(): boolean {
		return Boolean(this.details && Object.keys(this.details).length > 0);
	}
}

/**
 * 将 Retry-After 秒数或 HTTP 日期解析为本地恢复时刻。
 *
 * @param now - 客户端当前 Unix 毫秒时间，用于换算相对等待。
 * @param serverDate - 服务端 Date 响应头，用于修正客户端时钟偏差。
 * @returns 本地 Unix 毫秒恢复时刻；缺失或不可解析时返回 undefined。
 */
export function parseRetryAt(
	value: string | undefined,
	now = Date.now(),
	serverDate?: string,
): number | undefined {
	if (!value?.trim()) return undefined;
	const seconds = Number(value);
	if (!Number.isNaN(seconds)) {
		const retryAt = now + Math.ceil(seconds * 1000);
		return seconds >= 0 && Number.isFinite(retryAt) ? retryAt : undefined;
	}
	const deadline = Date.parse(value);
	if (!Number.isFinite(deadline)) return undefined;
	const serverNow = serverDate ? Date.parse(serverDate) : Number.NaN;
	return Math.max(now, Number.isFinite(serverNow) ? now + deadline - serverNow : deadline);
}
