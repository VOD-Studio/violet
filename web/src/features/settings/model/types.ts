/**
 * SiteSettings - 站点公开设置
 *
 * 对接后端 GET /api/v1/settings（公开子集）。
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
	/** 公告内容（Markdown） */
	content: string;
	/** 是否置顶 */
	pinned: boolean;
	/** 创建时间 RFC3339 */
	created_at: string;
}

/**
 * AdminSiteSettings - 管理员站点设置（完整字段）
 *
 * 对接后端 GET /admin/settings、PUT /admin/settings，
 * 字段对齐 domain/settings/entity.go 的 SiteSettings 读模型。
 * 比公开 SiteSettings 多出敏感字段，见存疑点文档。
 */
export interface AdminSiteSettings {
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
	/** GitHub Token（敏感） */
	github_token: string;
	/** 技术栈文本 */
	tech_stack: string;
	/** 站长简介 */
	bio: string;
	/** 页脚文案 */
	footer_text: string;
}

/**
 * UpdateSettings - 更新站点设置请求体
 *
 * 对接 PUT /admin/settings。后端用指针字段做部分更新，nil 不更新。
 * 全字段可选，按需传需改的字段。
 */
export interface UpdateSettings {
	/** 站点名称 */
	site_name?: string;
	/** 站点描述 */
	site_description?: string;
	/** 站点 URL */
	site_url?: string;
	/** 管理员邮箱 */
	admin_email?: string;
	/** 每页文章数 */
	posts_per_page?: number;
	/** 是否启用评论 */
	comments_enabled?: boolean;
	/** 评论是否需要审核 */
	comments_moderation?: boolean;
	/** GitHub 用户名 */
	github_username?: string;
	/** GitHub Token */
	github_token?: string;
	/** 技术栈文本 */
	tech_stack?: string;
	/** 站长简介 */
	bio?: string;
	/** 页脚文案 */
	footer_text?: string;
}

/**
 * AnnouncementType - 公告类型枚举
 *
 * 对齐 domain/announcement/entity.go，info/warning/success/error。
 */
export type AnnouncementType = "info" | "warning" | "success" | "error";

/**
 * AdminAnnouncement - 管理员公告读模型
 *
 * 对接后端 GET /admin/announcements 与 GET /admin/announcements/{id}，
 * 字段对齐 application/announcement/service.go 的 AnnouncementDTO。
 */
export interface AdminAnnouncement {
	/** 公告 ID，后端 int32 */
	id: number;
	/** 标题 */
	title: string;
	/** 内容 */
	content: string;
	/** 类型，info/warning/success/error */
	type: AnnouncementType;
	/** 是否生效 */
	is_active: boolean;
	/** 生效起始时间 RFC3339，可省略 */
	start_time?: string;
	/** 生效结束时间 RFC3339，可省略 */
	end_time?: string;
	/** 创建时间 RFC3339 */
	created_at: string;
}

/**
 * CreateAnnouncement - 创建公告请求体
 *
 * 对接 POST /admin/announcements，title/content/type 必填，
 * type 必须为 info/warning/success/error 之一。
 */
export interface CreateAnnouncement {
	/** 标题，必填 */
	title: string;
	/** 内容，必填 */
	content: string;
	/** 类型，必填，info/warning/success/error */
	type: AnnouncementType;
	/** 是否生效 */
	is_active?: boolean;
	/** 生效起始时间 RFC3339 */
	start_time?: string;
	/** 生效结束时间 RFC3339 */
	end_time?: string;
}

/**
 * UpdateAnnouncement - 更新公告请求体
 *
 * 对接 PATCH /admin/announcements/{id}，复用 announcementRequest 结构。
 */
export type UpdateAnnouncement = CreateAnnouncement;
