import type { GalleryListQuery } from "@entities/gallery/model/types";

/** 后台图集 query key 工厂。 */
export const galleryKeys = {
	all: ["admin-galleries"] as const,
	lists: () => [...galleryKeys.all, "list"] as const,
	list: (query: GalleryListQuery) => [...galleryKeys.lists(), query] as const,
	details: () => [...galleryKeys.all, "detail"] as const,
	detail: (id: string) => [...galleryKeys.details(), id] as const,
};
