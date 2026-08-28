const galleriesRoot = ["galleries"] as const;

export const galleryKeys = {
	all: galleriesRoot,
	details: () => [...galleriesRoot, "detail"] as const,
	detail: (id: string) => [...galleryKeys.details(), id] as const,
};
