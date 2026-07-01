/**
 * projects 模块类型定义
 *
 * 项目读模型与列表查询参数，对接 GET /projects、GET /projects/{id}。
 * 后台写操作请求体见 admin-projects。
 *
 * 字段来源 application/project/service.go 的 ProjectDTO，snake_case。
 */

/**
 * Project - 项目读模型
 *
 * 对应后端 ProjectDTO，List 与 Get 共用此结构。
 */
export interface Project {
    /** 项目 ID，UUID 字符串 */
    id: string;
    /** 项目标题 */
    title: string;
    /** 项目描述 */
    description: string;
    /** 项目主页 URL */
    url: string;
    /** GitHub 仓库 URL */
    github_url: string;
    /** 封面图 URL */
    image_url: string;
    /** 技术栈标签列表 */
    tech_stack: string[];
    /** 排序权重，越小越靠前 */
    sort_order: number;
    /** 创建时间，RFC3339 字符串 */
    created_at: string;
}

/**
 * ProjectListQuery - 项目列表查询参数
 *
 * 后端 ListProjects 当前未解析 query 参数，直接返回全量列表。
 * page/limit 仅为前端预留，待后端补齐分页后生效。
 */
export interface ProjectListQuery {
    /** 页码，从 1 开始，当前后端忽略 */
    page?: number;
    /** 每页条数，当前后端忽略 */
    limit?: number;
}
