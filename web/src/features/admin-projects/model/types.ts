/**
 * admin-projects 模块类型定义
 *
 * 后台项目管理的写操作请求体。领域读模型 Project 见 projects/model。
 */

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
