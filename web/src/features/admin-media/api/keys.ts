import type { AdminMediaListQuery } from "../model/types";

/**
 * adminMediaKeys - 后台媒体管理 query key 工厂
 *
 * 集中管理 key，便于按维度 invalidate。
 */
export const adminMediaKeys = {
    /** 模块根 */
    all: ["admin-media"] as const,
    /** 列表维度 */
    lists: () => [...adminMediaKeys.all, "list"] as const,
    /** 具体列表查询 */
    list: (query: AdminMediaListQuery) => [...adminMediaKeys.lists(), query] as const,
};
