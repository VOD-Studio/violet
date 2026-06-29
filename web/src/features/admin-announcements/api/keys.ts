/**
 * announcementKeys - 公告查询的 query key 工厂
 *
 * 用工厂模式集中管理 key，避免散落字符串导致缓存失效不彻底。
 * 子键按 list/detail 维度组织，便于按维度 invalidate。
 */
export const announcementKeys = {
    /** 公告模块根 key */
    all: ["announcements"] as const,
    /** 列表维度，用于 mutation 后批量 invalidate */
    lists: () => [...announcementKeys.all, "list"] as const,
    /** 具体列表查询 */
    list: () => [...announcementKeys.lists()] as const,
    /** 详情维度 */
    detail: (id: number) => [...announcementKeys.all, "detail", id] as const,
};
