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
/** 单个关于页区块配置 */
export interface AboutSection {
	id: string;
	enabled: boolean;
	order?: number;
	params?: Record<string, unknown>;
}

/** 关于页区块版面配置（about_config 字段结构） */
export interface AboutConfig {
	sections: AboutSection[];
}

export interface SiteSettings {
	/** 站点名称 */
	site_name: string;
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
	/** 个人简介 */
	bio: string;
	/** 页脚文案 */
	footer_text: string;
	/**
	 * 关于页区块版面配置（原生 JSON 对象，后端 json.RawMessage 序列化）。
	 * 结构 { sections: [{ id, enabled, order, params }] }，前台按 order 排序、enabled 过滤渲染。
	 * 未配置时为 null，前台回退默认全显。
	 */
	about_config: AboutConfig | null;
	/** 关于博主（A 线）内容字段 */
	avatar_url: string;
	tagline: string;
	profile_role: string;
	profile_location: string;
	available_for: string;
	skills_strong: string;
	skills_learning: string;
	skills_interests: string;
	social_twitter: string;
	social_mastodon: string;
	social_email: string;
	social_rss: string;
	social_bilibili: string;
	/** 是否启用代码运行器（阅读页据此决定渲染 CodeRunner 还是普通 pre） */
	code_runner_enabled: boolean;
}

/** 公告严重程度(视觉维度:配色/图标/标签) */
export type { AnnouncementSeverity } from "@shared/ui/announcement-severity";
/** 公告展示形态(布局维度:banner/card/article) */
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
