import type { PageQuery } from "@shared/api/types";

const galleriesRoot = ["galleries"] as const;

export const galleryKeys = {
	all: galleriesRoot,
	list: (query: PageQuery) => [...galleriesRoot, "list", query] as const,
	userList: (username: string, query: PageQuery) =>
		[...galleriesRoot, "userList", username, query] as const,
	adminList: (query: PageQuery) => [...galleriesRoot, "adminList", query] as const,
	details: () => [...galleriesRoot, "detail"] as const,
	detail: (id: string) => [...galleryKeys.details(), id] as const,
};
