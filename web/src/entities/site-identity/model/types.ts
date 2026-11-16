/** 服务端筛选、归一后可直接展示的社交或订阅入口。 */
export interface SiteIdentityLink {
	/** 社交类型为 github、twitter、mastodon、email、bilibili；当前订阅类型为 rss。 */
	kind: string;
	label: string;
	/** 已校验的 HTTP(S) URL、站内根相对路径或 mailto 链接。 */
	href: string;
}

/**
 * 首页首屏的背景图与引语配置。
 *
 * @remarks 引语原文、译文与作者均由服务端补齐默认值，前端不另设一套默认内容。
 */
export interface SiteIdentityHero {
	/** null 表示使用前端内置背景。 */
	banner_url: string | null;
	quote: string;
	quote_translation: string;
	quote_author: string;
}

/** 首页发布足迹的展示开关与自然日聚合配置。 */
export interface SiteIdentityHome {
	footprint_enabled: boolean;
	/** 合法范围 1–31，服务端非法值回退为 7。 */
	footprint_aggregation_days: number;
}

/**
 * 供首页、公共页头与订阅源共用的公开站点身份。
 *
 * @remarks 对应匿名 GET /site-identity；服务端已应用默认值、URL 校验与敏感字段隔离，
 * 不等同于管理端站点设置，也不包含当前登录用户的信息。
 */
export interface SiteIdentity {
	site_name: string;
	site_url: string;
	/** 站长展示名，依次取有效 GitHub 用户名、公开站点域名首段或站名。 */
	owner_name: string;
	/** 依次取站点副标题、简介或服务端默认介绍，不是登录用户简介。 */
	bio: string;
	/** 站点头像或 GitHub 头像地址；未配置有效地址且无 GitHub 用户名时为空串。 */
	avatar_url: string;
	/** 未配置时为空串；消费方不渲染所在地行。 */
	location: string;
	hero: SiteIdentityHero;
	/** 仅含有效社交入口；未配置或全部无效时为 []，不返回 null。 */
	social_links: SiteIdentityLink[];
	/** 当前已实现的订阅渠道；目前始终提供 rss，未配置地址时使用 /feed.xml。 */
	subscription_channels: SiteIdentityLink[];
	home: SiteIdentityHome;
}
