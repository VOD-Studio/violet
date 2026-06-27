/**
 * tagKeys - 标签查询的 query key 工厂
 *
 * 用工厂模式集中管理 key，避免散落字符串导致缓存失效不彻底。
 * 子键按 list/detail 维度组织，便于按维度 invalidate。
 */
export const tagKeys = {
    /** 标签模块根 key */
    all: ["tags"] as const,
    /** 标签列表维度，用于 mutation 后批量 invalidate */
    lists: () => [...tagKeys.all, "list"] as const,
    /** 具体列表查询，参数为预留扩展位 */
    list: () => [...tagKeys.lists()] as const,
};
