/**
 * admin-logs 模块类型定义
 *
 * 对接后端 GET /admin/logs 与 GET /admin/logs/user/{id}。
 *
 * 重要：handler 直接把领域实体 domain.AuditLog 透传给 RespondPaged 序列化，
 * 该领域结构体未打 json tag，Go 默认按字段名输出为 PascalCase，
 * 故本接口字段为 ID/UserID/Action/Resource/ResourceID/Detail/IPAddress/CreatedAt，
 * 与同仓其他 DTO 的 snake_case 不同。若后端后续补 json tag，需同步改此处为 snake_case。
 */

/**
 * AuditLog - 操作日志记录
 *
 * 对应后端 domain/audit/entity.go 的 AuditLog。
 */
export interface AuditLog {
	/** 日志 ID */
	ID: number;
	/** 操作者用户 ID，匿名操作时为 null */
	UserID: string | null;
	/** 操作类型，如 create/update/delete/login/approve/ban */
	Action: string;
	/** 资源类型，如 user/post/comment/role/setting */
	Resource: string;
	/** 资源 ID */
	ResourceID: string;
	/** 变更详情，结构由具体操作决定，无详情时为空对象 */
	Detail: Record<string, unknown>;
	/** 操作者 IP 地址 */
	IPAddress: string;
	/** 操作时间，RFC3339 字符串 */
	CreatedAt: string;
}

/**
 * LogListQuery - 操作日志列表查询参数
 *
 * 后端 ListLogs handler 仅解析 page/limit，不支持 action/user_id 等筛选，
 * 故此处只暴露分页参数。按用户筛选请改用 fetchAuditLogsByUser。
 */
export interface LogListQuery {
	/** 页码，从 1 开始，默认 1 */
	page?: number;
	/** 每页条数，默认 20，后端限制上限 100 */
	limit?: number;
}
