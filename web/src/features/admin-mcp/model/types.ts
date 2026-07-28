/** PAT 可选 scope */
export const PAT_SCOPES = [
    "posts:read",
    "posts:write",
    "posts:publish",
    "posts:scrape",
    "subscriptions:read",
    "subscriptions:write",
] as const;
export type PATScope = (typeof PAT_SCOPES)[number];

/** PAT 过期：ISO 日期或 "never"，空串后端默认 90 天 */
export type PATExpiry = string;

/** MCP server 规格，新增 server 在此追加即可 */
export interface MCPServerSpec {
    /** mcpServers 配置里的 key */
    key: string;
    /** 显示名 */
    label: string;
    /** 后端端点路径 */
    endpoint: string;
    /** 能力描述 */
    description: string;
    /** 该 server 涉及的 scope */
    scopes: string[];
}

export const MCP_SERVERS: MCPServerSpec[] = [
    {
        key: "violet",
        label: "文章",
        endpoint: "/api/v1/mcp",
        description: "5 个文章 CRUD tool",
        scopes: ["posts:read", "posts:write", "posts:publish"],
    },
    {
        key: "violet-scraper",
        label: "抓取",
        endpoint: "/api/v1/mcp/scraper",
        description: "scrape_url + 7 个订阅 tool",
        scopes: ["posts:scrape", "subscriptions:read", "subscriptions:write"],
    },
];

/** serversForScopes - 按 PAT scope 推导可见的 MCP server：命中该 server 任一 scope 即包含 */
export function serversForScopes(scopes: readonly string[]): MCPServerSpec[] {
    const set = new Set(scopes);
    return MCP_SERVERS.filter((s) => s.scopes.some((sc) => set.has(sc)));
}

/** PAT 读模型 */
export interface PATDTO {
    id: string;
    name: string;
    scopes: PATScope[];
    /** RFC3339，空表示永不过期 */
    expires_at?: string;
    /** RFC3339，空表示从未使用 */
    last_used_at?: string;
    created_at: string;
    /** 明文 token，仅创建响应返回 */
    token?: string;
}

/** 创建 PAT 请求 */
export interface CreatePATRequest {
    name: string;
    scopes: PATScope[];
    expires_at: string;
}
