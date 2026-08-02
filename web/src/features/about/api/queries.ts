import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";

/** 公开只读统计 */
export interface PublicStats {
    posts_count: number;
    total_words: number;
    comments_count: number;
    uptime_days: number;
}

export interface ReleaseCategory {
    /** 分类标题（如"新功能"、"Bug 修复"） */
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

/** aboutKeys - 关于页数据查询的 query key 工厂 */
export const aboutKeys = {
    all: ["about"] as const,
    stats: () => [...aboutKeys.all, "stats"] as const,
    releases: () => [...aboutKeys.all, "releases"] as const,
};

/** fetchPublicStats - 调 GET /api/v1/stats 获取公开统计 */
export const fetchPublicStats = async (): Promise<PublicStats> => apiGet<PublicStats>("/stats");

/** usePublicStats - 站点生命体征统计 hook（staleTime 10 分钟） */
export const usePublicStats = () =>
    useQuery({
        queryKey: aboutKeys.stats(),
        queryFn: fetchPublicStats,
        staleTime: 10 * 60 * 1000,
    });

/** fetchReleases - 调 GET /api/v1/releases 获取更新日志 */
export const fetchReleases = async (): Promise<ReleasesData> => apiGet<ReleasesData>("/releases");

/** useReleases - 更新日志 hook（staleTime 30 分钟，更新频率低） */
export const useReleases = () =>
    useQuery({
        queryKey: aboutKeys.releases(),
        queryFn: fetchReleases,
        staleTime: 30 * 60 * 1000,
    });
