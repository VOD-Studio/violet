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

/** 服务端归一后的公开站点身份，不含管理设置。 */
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
