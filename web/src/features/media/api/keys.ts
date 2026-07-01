import type { MediaListQuery } from "../model/types";

/**
 * mediaKeys - 前台媒体文件 query key 工厂
 *
 * 用工厂模式集中管理 key，避免散落字符串导致缓存失效不彻底。
 * 后台管理 key 见 admin-media。
 */
export const mediaKeys = {
    /** 媒体模块根 key */
    all: ["media"] as const,
    /** 列表维度 */
    lists: () => [...mediaKeys.all, "list"] as const,
    /** 具体列表查询 */
    list: (query: MediaListQuery) => [...mediaKeys.lists(), query] as const,
    /** 详情维度 */
    details: () => [...mediaKeys.all, "detail"] as const,
    /** 具体媒体详情 */
    detail: (id: string) => [...mediaKeys.details(), id] as const,
};
