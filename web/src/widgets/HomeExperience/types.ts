export type HomePublicationKind = "article" | "note" | "gallery";

/** 首页直接消费的轻量发布物资源。 */
export interface HomePublicationItem {
	/** 类型与来源 UUID 组成的稳定标识。 */
	id: string;
	kind: HomePublicationKind;
	/** 文章和图集为 slug，笔记为 UUID。 */
	route_key: string;
	title: string;
	/** RFC3339 发布时间。 */
	published_at: string;
	/** 仅文章可能为 true。 */
	featured: boolean;
}

export interface PublicationQuery {
	cursor?: string;
	limit?: number;
	from?: string;
	to?: string;
	featured?: boolean;
}

/** 最近十二个自然月的 RFC3339 半开区间。 */
export interface PublicationWindow {
	from: string;
	to: string;
}

export interface SiteIdentityLink {
	kind: string;
	label: string;
	href: string;
}

export interface SiteIdentityHero {
	/** null 表示使用前端内置背景。 */
	banner_url: string | null;
	quote: string;
	quote_translation: string;
	quote_author: string;
}

export interface SiteIdentityHome {
	footprint_enabled: boolean;
	/** 合法范围 1–31，服务端非法值回退为 7。 */
	footprint_aggregation_days: number;
}

/** 首页公开站点身份；字段已经服务端归一且不含管理设置。 */
export interface SiteIdentity {
	site_name: string;
	site_url: string;
	owner_name: string;
	bio: string;
	avatar_url: string;
	location: string;
	hero: SiteIdentityHero;
	social_links: SiteIdentityLink[];
	subscription_channels: SiteIdentityLink[];
	home: SiteIdentityHome;
}

export interface SiteImpressionState {
	/** 主动留下印记的去重匿名设备数，不是浏览量或可信 UV。 */
	count: number;
	/** 当前 violet_impression Cookie 是否已登记。 */
	impressed: boolean;
}
