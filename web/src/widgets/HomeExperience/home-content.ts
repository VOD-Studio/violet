import type { HomePublicationItem, HomePublicationKind } from "./types";

export const HOME_KIND_LABEL: Record<HomePublicationKind, string> = {
	article: "文心",
	note: "札记",
	gallery: "撷影",
};

/** 精选文章优先成为当期主内容；没有精选时使用最新发布。 */
export function selectHomeLead(items: HomePublicationItem[]): HomePublicationItem | null {
	return items.find((item) => item.kind === "article" && item.featured) ?? items[0] ?? null;
}
