import { projectKeys } from "@entities/project/api/keys";

/** 路线图嵌入将「不存在」与「出错」也作为结果，和详情页分开缓存。 */
export const roadmapKeys = {
	all: [...projectKeys.all, "roadmap"] as const,
	detail: (slug: string) => [...roadmapKeys.all, slug] as const,
	embed: (slug: string) => [...roadmapKeys.all, slug, "embed"] as const,
};
