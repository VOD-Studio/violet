/**
 * projects 模块类型定义
 *
 * 对接后端 GET /projects、GET /projects/{id} 与
 * POST /admin/projects、PUT /admin/projects/{id}、DELETE /admin/projects/{id}。
 *
 * 字段来源 application/project/service.go 的 ProjectDTO，struct 显式打了 json tag，
 * 全部为 snake_case，与同仓 posts 模块风格一致。
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
 * 后端 ListProjects handler 当前未解析任何 query 参数，直接返回全量列表，
 * 此处的 page/limit 仅为前端预留，待后端补齐分页后即可生效。
 */
export interface ProjectListQuery {
	/** 页码，从 1 开始，当前后端忽略 */
	page?: number;
	/** 每页条数，当前后端忽略 */
	limit?: number;
}

/**
 * CreateProject - 创建项目请求体
 *
 * 对应后端 projectRequest，title 必填，其余可选。
 */
export interface CreateProject {
	/** 项目标题，必填 */
	title: string;
	/** 项目描述 */
	description?: string;
	/** 项目主页 URL */
	url?: string;
	/** GitHub 仓库 URL */
	github_url?: string;
	/** 封面图 URL */
	image_url?: string;
	/** 技术栈标签列表 */
	tech_stack?: string[];
	/** 排序权重，越小越靠前 */
	sort_order?: number;
}

/**
 * UpdateProject - 更新项目请求体
 *
 * 后端复用 projectRequest 结构，字段与 CreateProject 一致。
 */
export type UpdateProject = CreateProject;
