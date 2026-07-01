/**
 * settings 模块类型定义
 *
 * 仅含公开站点配置与公告读模型。后台管理类型见 admin-settings、admin-announcements。
 */

/**
 * SiteSettings - 站点公开设置
 *
 * 对接后端 GET /api/v1/settings，公开子集。
 * 字段对齐 application/settings/service.go 的 GetPublic 返回 map。
 */
export interface SiteSettings {
    /** 站点名称 */
    siteName: string;
    /** 站点描述 */
    description: string;
    /** 站长昵称 */
    authorName: string;
    /** 站长签名/标语 */
    tagline: string;
    /** 社交链接 */
    socials: {
        /** GitHub 主页 */
        github?: string;
        /** Twitter 主页 */
        twitter?: string;
        /** 联系邮箱 */
        email?: string;
    };
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
