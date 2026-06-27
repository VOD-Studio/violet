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
}

/**
 * ApiError - 归一化的 API 错误
 *
 * httpClient 的 response interceptor 把后端错误响应（或网络错误）
 * 统一转成此类型抛出，业务层只需 catch ApiError 即可处理所有 API 失败。
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

    constructor(init: ApiErrorInit) {
        super(init.message);
        this.name = "ApiError";
        this.code = init.error;
        this.status = init.status;
        this.details = init.details;
        this.requestId = init.requestId;
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
