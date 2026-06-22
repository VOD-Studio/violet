/**
 * API 类型定义
 *
 * 对接后端统一响应封装（commit 4179965），所有 HTTP 响应都遵循此结构。
 * 纯类型零运行时代码，任何层都可 import 不引入循环依赖。
 */

/**
 * 后端统一响应信封
 *
 * @typeParam T - data 字段的业务类型
 */
export interface Envelope<T = unknown> {
	/** 业务数据载荷（对象/数组/null） */
	data: T;
	/** 元数据（消息或分页），可省略 */
	meta?: EnvelopeMeta;
}

/**
 * 信封元数据
 */
export interface EnvelopeMeta {
	/** 操作消息（如"删除成功"） */
	message?: string;
	/** 分页信息 */
	pagination?: Pagination;
}

/**
 * 分页元数据（offset 与 cursor 模式共用）
 *
 * 后端实际只在 offset 模式填充 page/total/total_pages，
 * cursor 模式当前无生产路由使用，字段保留以备扩展。
 */
export interface Pagination {
	/** 当前页码（offset 模式，从 1 开始） */
	page?: number;
	/** 每页条数（始终存在） */
	limit: number;
	/** 总记录数（offset 模式） */
	total?: number;
	/** 总页数（offset 模式） */
	total_pages?: number;
	/** 是否还有下一页（cursor 模式 / offset 便利字段） */
	has_more?: boolean;
	/** 下一页游标（cursor 模式） */
	next_cursor?: string;
}

/**
 * 后端错误响应（独立结构，不在 data 字段下）
 *
 * 状态码映射见后端 response/error.go：NOT_FOUND→404、UNAUTHORIZED→401 等。
 */
export interface ApiErrorShape {
	/** 机器错误码：NOT_FOUND / UNAUTHORIZED / FORBIDDEN / INTERNAL_ERROR 等 */
	error: string;
	/** 人类可读消息 */
	message: string;
	/** 请求追踪 ID（对应 X-Request-Id） */
	request_id?: string;
	/** 字段级校验错误（422/400 时存在） */
	details?: Record<string, string[]>;
}

/**
 * offset 分页查询参数
 */
export interface PageQuery {
	/** 页码，从 1 开始 */
	page?: number;
	/** 每页条数 */
	limit?: number;
}

/**
 * 分页响应（httpClient 解包后的形态）
 *
 * httpClient 的 response interceptor 把后端 envelope 拆成此结构，
 * 业务层直接拿到 data 列表 + pagination，无需感知 envelope。
 *
 * @typeParam T - 列表元素类型
 */
export interface PagedResponse<T> {
	/** 数据列表 */
	data: T[];
	/** 分页元数据 */
	pagination: Pagination;
}
