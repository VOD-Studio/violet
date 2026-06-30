/**
 * admin-audit-logs 模块类型定义
 *
 * 对齐后端 domain/audit.AuditLog（GET /admin/logs 返回）。
 */

/** AuditLogDTO - 操作日志数据传输对象 */
export interface AuditLogDTO {
    /** 日志主键 */
    id: number;
    /** 操作人 ID（匿名操作时为 null） */
    user_id: string | null;
    /** 操作人用户名（JOIN users 查出，可能为空字符串） */
    user_name: string;
    /** 操作类型：create/update/delete/login 等 */
    action: string;
    /** 资源类型：user/post/comment 等 */
    resource: string;
    /** 资源 ID */
    resource_id: string;
    /** 资源名称（用户名/文章标题等，可能为空字符串） */
    resource_name: string;
    /** 变更详情（任意结构，可能为 null） */
    detail: Record<string, unknown> | null;
    /** 来源 IP */
    ip_address: string;
    /** 发生时间（RFC3339 字符串） */
    created_at: string;
}

/** AuditLogListQuery - 操作日志列表查询参数 */
export interface AuditLogListQuery {
    /** 页码（从 1 开始） */
    page?: number;
    /** 每页条数 */
    limit?: number;
}
