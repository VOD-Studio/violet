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
    /** 该 server 涉及的 scope；匿名 server 为 [] */
    scopes: string[];
    /** 匿名可读：不进 PAT 对话框、配置不带 Authorization、任何 scope 上下文均可见 */
    anonymous?: boolean;
}

export const MCP_SERVERS: MCPServerSpec[] = [
    {
        key: "violet",
        label: "文章",
        endpoint: "/api/v1/mcp",
        description: "文章读写 + 检索 tool",
        scopes: ["posts:read", "posts:write", "posts:publish"],
    },
    {
        key: "violet-scraper",
        label: "抓取",
        endpoint: "/api/v1/mcp/scraper",
        description: "scrape_url + 7 个订阅 tool",
        scopes: ["posts:scrape", "subscriptions:read", "subscriptions:write"],
    },
    {
        key: "violet-reader",
        label: "公开阅读",
        endpoint: "/api/v1/mcp/reader",
        description: "已发布文章 Resources + 写作风格 Prompts，匿名只读",
        scopes: [],
        anonymous: true,
    },
];

/** serversForScopes - 按 PAT scope 推导可见的 MCP server：匿名 server 恒可见，
 * scope 命中任一即包含。匿名 reader 恒并入是为了让用户主路径（创建 PAT → 复制配置）
 * 也能看到公开通道，否则 reader 只在初始占位态出现，推广落空。 */
export function serversForScopes(scopes: readonly string[]): MCPServerSpec[] {
    const set = new Set(scopes);
    return MCP_SERVERS.filter((s) => s.anonymous || s.scopes.some((sc) => set.has(sc)));
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
