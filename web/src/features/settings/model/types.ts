/**
 * settings 模块类型定义
 *
 * 仅含公开站点配置与公告读模型。后台管理类型见 admin-settings、admin-announcements。
 */

/**
 * SiteSettings - 站点公开设置
 *
 * 对接后端 GET /api/v1/settings，公开子集。
 * 字段对齐 application/settings/service.go 的 GetPublic 返回 map（snake_case）。
 */
export interface SiteSettings {
    /** 站点名称 */
    site_name: string;
    /** 站点描述 */
    site_description: string;
    /** 站点 URL */
    site_url: string;
    /** 每页文章数 */
    posts_per_page: number;
    /** 是否启用评论 */
    comments_enabled: boolean;
    /** 评论是否需审核 */
    comments_moderation: boolean;
    /** GitHub 用户名 */
    github_username: string;
    /** 技术栈（单字符串） */
    tech_stack: string;
    /** 个人简介 */
    bio: string;
    /** 页脚文案 */
    footer_text: string;
}

/**
 * Announcement - 公告
 *
 * 对接后端 GET /api/v1/announcements。
 */
export interface Announcement {
    /** 公告 ID */
    id: string;
    /** 公告内容，Markdown */
    content: string;
    /** 是否置顶 */
    pinned: boolean;
    /** 创建时间 RFC3339 */
    created_at: string;
}
