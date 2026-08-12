/** admin-audit-logs 模块类型定义 */

/** FieldChangeDTO - 单字段 before/after 变更 */
export interface FieldChangeDTO {
	/** 字段名（如 role/is_active/username） */
	field: string;
	/** 变更前值 */
	from: unknown;
	/** 变更后值 */
	to: unknown;
}

/** ActorDTO - 操作人快照 */
export interface ActorDTO {
	/** 操作者类型（user=真人操作，system=系统自动化如定时任务） */
	actor_type: "user" | "system";
	/** 操作人 UUID（匿名操作时为空串） */
	user_id: string;
	/** 操作人用户名快照（用户删除后仍可追溯；system 类型存作业名） */
	user_name: string;
	/** 来源 IP */
	ip_address: string;
	/** User-Agent */
	user_agent: string;
}

/** ResourceDTO - 资源引用快照 */
export interface ResourceDTO {
	/** 资源类型：user/post/role/announcement/auth */
	type: string;
	/** 资源 ID */
	id: string;
	/** 资源名称快照（文章标题/用户名等，可空） */
	name?: string;
}

/** AuditEventDTO - 操作日志事件（append-only 审计存储的读模型） */
export interface AuditEventDTO {
	/** 事件 UUID（幂等去重） */
	event_id: string;
	/** 操作类型（受控枚举：create/update/delete/publish/fetch_feed 等） */
	action: string;
	/** 操作人 */
	actor: ActorDTO;
	/** 资源引用 */
	resource: ResourceDTO;
	/** 人话摘要（后端生成，存量旧记录为空） */
	summary?: string;
	/** 字段变更列表（before/after，update 类事件有值） */
	changes?: FieldChangeDTO[];
	/** 兜底元数据（如登录 provider、批量 count） */
	metadata?: Record<string, unknown>;
	/** 发生时间（RFC3339 字符串） */
	occurred_at: string;
}

/** AuditLogListQuery - 操作日志列表查询参数（分页 + 过滤） */
export interface AuditLogListQuery {
	/** 页码（从 1 开始） */
	page?: number;
	/** 每页条数 */
	limit?: number;
	/** 操作类型过滤（精确匹配） */
	action?: string;
	/** 资源类型过滤（精确匹配） */
	resource_type?: string;
	/** 操作人 UUID 过滤（精确匹配） */
	actor?: string;
}
