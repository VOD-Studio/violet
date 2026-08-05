import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";

/** 分类（如「新功能」「修复」）下的变更条目 */
export interface ReleaseCategory {
	/** 分类标题（如「新功能」、「Bug 修复」） */
	label: string;
	/** 该分类下的变更条目（markdown） */
	items: string[];
}

/** 单个版本发布 */
export interface Release {
	tag: string;
	name: string;
	published_at: string;
	body: string;
	categories: ReleaseCategory[];
	breaking: boolean;
	html_url: string;
}

/** 更新日志聚合 */
export interface ReleasesData {
	current_version: string;
	releases: Release[];
}

/** releasesKeys - 更新日志 query key 工厂 */
export const releasesKeys = {
	all: ["releases"] as const,
};

/** fetchReleases - 调 GET /api/v1/releases 获取更新日志 */
export const fetchReleases = async (): Promise<ReleasesData> => apiGet<ReleasesData>("/releases");

/** useReleases - 更新日志 hook（staleTime 30 分钟，更新频率低） */
export const useReleases = () =>
	useQuery({
		queryKey: releasesKeys.all,
		queryFn: fetchReleases,
		staleTime: 30 * 60 * 1000,
	});
