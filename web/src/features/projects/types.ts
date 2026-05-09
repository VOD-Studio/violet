/**
 * 项目功能类型定义
 */

/** 项目基本信息 */
export interface Project {
  /** 项目唯一标识 */
  id: string;
  /** 项目名称 */
  title: string;
  /** 项目描述 */
  description?: string;
  /** 项目 URL */
  url?: string;
  /** GitHub URL */
  github_url?: string;
  /** 封面图片 URL */
  image_url?: string;
  /** 技术栈 */
  tech_stack: string[];
  /** 排序序号 */
  sort_order: number;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/** 创建项目请求参数 */
export interface CreateProjectInput {
  title: string;
  description?: string;
  url?: string;
  github_url?: string;
  image_url?: string;
  tech_stack?: string[];
  sort_order?: number;
}

/** 更新项目请求参数 */
export interface UpdateProjectInput {
  title?: string;
  description?: string;
  url?: string;
  github_url?: string;
  image_url?: string;
  tech_stack?: string[];
  sort_order?: number;
}