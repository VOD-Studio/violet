// 站点设置类型定义

/** 站点设置数据结构 */
export interface SiteSettings {
  /** 站点名称 */
  site_name: string;
  /** 站点描述 */
  site_description: string;
  /** 站点 URL */
  site_url: string;
  /** 管理员邮箱 */
  admin_email: string;
  /** 每页文章数 */
  posts_per_page: number;
  /** 是否启用评论 */
  comments_enabled: boolean;
  /** 评论是否需要审核 */
  comments_moderation: boolean;
  /** GitHub 用户名 */
  github_username: string;
  /** 页脚文本 */
  footer_text: string;
}

/** 公开站点设置（不需要认证） */
export interface PublicSettings {
  /** 站点名称 */
  site_name: string;
  /** 站点描述 */
  site_description: string;
  /** GitHub 用户名 */
  github_username: string;
  /** 页脚文本 */
  footer_text: string;
}
