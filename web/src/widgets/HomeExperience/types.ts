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

export interface SiteImpressionState {
	/** 主动留下印记的去重匿名设备数，不是浏览量或可信 UV。 */
	count: number;
	/** 当前 violet_impression Cookie 是否已登记。 */
	impressed: boolean;
}
