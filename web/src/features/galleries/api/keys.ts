const galleriesRoot = ["galleries"] as const;

export const galleryKeys = {
	all: galleriesRoot,
	list: (query: { page?: number; limit?: number }) => [...galleriesRoot, "list", query] as const,
	details: () => [...galleriesRoot, "detail"] as const,
	detail: (id: string) => [...galleryKeys.details(), id] as const,
};
