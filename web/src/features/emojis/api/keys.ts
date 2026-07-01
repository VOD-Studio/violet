/**
 * emojiKeys - 公开表情 query key 工厂
 *
 * 后台管理 key 见 admin-emojis。
 */
export const emojiKeys = {
    /** 表情模块根 key */
    all: ["emojis"] as const,
    /** 公开分组维度 */
    publicGroups: () => [...emojiKeys.all, "public-groups"] as const,
    /** 全部启用分组，无参数 */
    publicGroupList: () => [...emojiKeys.publicGroups(), "list"] as const,
    /** 按名称获取的公开分组 */
    publicGroupByName: (name: string) => [...emojiKeys.publicGroups(), "name", name] as const,
};
