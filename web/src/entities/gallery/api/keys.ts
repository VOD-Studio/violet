import type { PublishedGalleryListQuery } from "@entities/gallery/model/types";

/** 公开图集 query key 工厂。 */
export const publishedGalleryKeys = {
	all: ["published-galleries"] as const,
	lists: () => [...publishedGalleryKeys.all, "list"] as const,
	list: (query: PublishedGalleryListQuery) => [...publishedGalleryKeys.lists(), query] as const,
	details: () => [...publishedGalleryKeys.all, "detail"] as const,
	detail: (slug: string) => [...publishedGalleryKeys.details(), slug] as const,
};
