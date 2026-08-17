/** mcpKeys - PAT 管理 query key 工厂 */
import type { PageQuery } from "@shared/api/types";

export const mcpKeys = {
	/** 模块根 */
	all: ["mcp"] as const,
	/** PAT 列表（含分页参数） */
	tokens: (query: PageQuery) => [...mcpKeys.all, "tokens", query] as const,
};
