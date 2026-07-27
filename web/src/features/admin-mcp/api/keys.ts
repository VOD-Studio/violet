/** mcpKeys - PAT 管理 query key 工厂 */
export const mcpKeys = {
    /** 模块根 */
    all: ["mcp"] as const,
    /** PAT 列表 */
    tokens: () => [...mcpKeys.all, "tokens"] as const,
};
