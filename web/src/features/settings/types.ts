/**
 * 站点设置类型定义
 */

/** 公开站点设置（无需认证） */
export interface SiteSettings {
  /** 站点名称 */
  site_name: string;
  /** 站点描述 */
  site_description: string;
  /** GitHub 用户名 */
  github_username: string;
  /** 页脚文字 */
  footer_text: string;
  /** 每页文章数 */
  posts_per_page: number;
}