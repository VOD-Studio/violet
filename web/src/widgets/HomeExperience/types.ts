import type { PublishedGallery } from "@entities/gallery/model/types";
import type { PublicNote } from "@entities/note/model/types";
import type { Post } from "@entities/post/model/types";
import type { Tweet } from "@entities/tweet/model/types";
import type { SeriesSummary } from "@features/series/model/types";
import type { SiteSettings } from "@features/settings/model/types";

/** 首页首屏与后续编排消费的公开数据快照。 */
export interface HomeSnapshot {
	settings: SiteSettings | null;
	posts: Post[];
	postTotal: number;
	notes: PublicNote[];
	galleries: PublishedGallery[];
	series: SeriesSummary[];
	tweets: Tweet[];
}

export type HomePublicationKind = "article" | "note" | "gallery" | "series";

/** 首页把不同发布模型投影成同一目录节奏，但保留原始类型与路由。 */
export interface HomePublicationItem {
	key: string;
	kind: HomePublicationKind;
	/** 文章、图集与系列使用 slug，笔记使用 ID。 */
	routeKey: string;
	title: string;
	publishedAt: string;
	isFeatured: boolean;
}
