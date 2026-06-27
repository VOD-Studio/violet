/**
 * githubKeys - GitHub 数据查询的 query key 工厂
 */
export const githubKeys = {
    /** GitHub 模块根 key */
    all: ["github"] as const,
    /** 贡献图维度 */
    contributions: () => [...githubKeys.all, "contributions"] as const,
    /** 仓库列表维度 */
    repos: () => [...githubKeys.all, "repos"] as const,
};
