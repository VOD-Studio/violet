import type { RoadmapItem } from "../model/roadmap";

/** 详情页 URL 中的筛选条件；关键词与单标签同时生效。 */
export interface RoadmapFilters {
	/** 保留原始输入；匹配标题或简介时去掉首尾空白。 */
	q?: string;
	/** 单个条目标签，按完整字符串精确匹配。 */
	tag?: string;
}

/** 无有效条件时返回 undefined，让看板退出筛选态；标签精确匹配，关键词忽略大小写和首尾空白。 */
export function createRoadmapFilter({ q, tag }: RoadmapFilters) {
	const keyword = q?.trim().toLowerCase() ?? "";
	if (!keyword && !tag) return undefined;
	return (item: RoadmapItem) =>
		(!keyword ||
			item.title.toLowerCase().includes(keyword) ||
			item.description.toLowerCase().includes(keyword)) &&
		(!tag || item.tags.includes(tag));
}
