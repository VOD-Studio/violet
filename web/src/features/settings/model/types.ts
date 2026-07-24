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
    /** 是否启用 Google 登录 */
    google_login_enabled: boolean;
    /** 是否启用 GitHub 登录 */
    github_login_enabled: boolean;
    /** GitHub 用户名 */
    github_username: string;
    /** 技术栈（单字符串） */
    tech_stack: string;
    /** 个人简介 */
    bio: string;
    /** 页脚文案 */
    footer_text: string;
    /** 是否启用代码运行器（阅读页据此决定渲染 CodeRunner 还是普通 pre） */
    code_runner_enabled: boolean;
}

/** 公告严重程度(视觉维度:配色/图标/标签),对齐后端 severity 枚举 */
export type { AnnouncementSeverity } from "@shared/ui/announcement-severity";
/** 公告展示形态(布局维度:banner/card/article),对齐后端 display 枚举 */
export type AnnouncementDisplay = "banner" | "card" | "article";

// re-import 仅供本模块内部使用（Announcement 接口引用），对外 API 已通过上方 re-export 保持不变
import type { AnnouncementSeverity } from "@shared/ui/announcement-severity";

/**
 * Announcement - 公告
 *
 * 对接后端 GET /api/v1/announcements。
 */
export interface Announcement {
    id: number;
    title: string;
    content: string;
    /** 严重程度(视觉语义),后端 type 字段的同义冗余 */
    severity: AnnouncementSeverity;
    /** 展示形态 */
    display: AnnouncementDisplay;
    is_active?: boolean;
    start_time?: string;
    end_time?: string;
    sort_order?: number;
    affects?: string[];
    content_md?: string;
    content_html?: string;
    cover_image?: string;
    excerpt?: string;
    created_at: string;
}
