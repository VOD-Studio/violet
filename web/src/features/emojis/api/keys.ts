/**
 * emojiKeys - 表情查询的 query key 工厂
 *
 * 用工厂模式集中管理 key，避免散落字符串导致缓存失效不彻底。
 * 公开查询与后台管理查询分维度组织，便于按维度 invalidate。
 */
export const emojiKeys = {
    /** 表情模块根 key */
    all: ["emojis"] as const,

    /** 公开分组维度 */
    publicGroups: () => [...emojiKeys.all, "public-groups"] as const,
    /** 全部启用分组，无参数 */
    publicGroupList: () => [...emojiKeys.publicGroups(), "list"] as const,
    /**
     * 按名称获取的公开分组
     *
     * @param name 分组名称
     */
    publicGroupByName: (name: string) => [...emojiKeys.publicGroups(), "name", name] as const,

    /** 后台分组维度 */
    adminGroups: () => [...emojiKeys.all, "admin-groups"] as const,
    /** 后台全部分组列表，含未启用 */
    adminGroupList: () => [...emojiKeys.adminGroups(), "list"] as const,
    /**
     * 后台分组内表情列表
     *
     * @param groupId 分组 ID
     */
    adminGroupEmojis: (groupId: number) => [...emojiKeys.adminGroups(), "emojis", groupId] as const,
};
