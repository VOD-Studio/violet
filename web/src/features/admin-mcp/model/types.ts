/**
 * admin-mcp 模块类型定义
 *
 * 对齐后端 application/api_token.PATDTO（GET/POST /admin/api-tokens 返回）。
 * scope 取值与后端 domain/api_token 常量一致（read/write/publish/scrape）。
 */

/** PAT 可选 scope（与后端 domain/api_token 的 ScopePosts* 与 ScopeSubscriptions* 对齐） */
export const PAT_SCOPES = [
    "posts:read",
    "posts:write",
    "posts:publish",
    "posts:scrape",
    "subscriptions:read",
    "subscriptions:write",
] as const;
export type PATScope = (typeof PAT_SCOPES)[number];

/** PAT 过期选项 */
export const PAT_EXPIRIES = ["90d", "365d", "never"] as const;
export type PATExpiry = (typeof PAT_EXPIRIES)[number];

/**
 * MCP server 清单（ADR-0007：文章 + 抓取两个独立端点）。
 * 未来新增 MCP server 只在此追加一项，MCPConfigCard 自动渲染对应勾选项与配置生成。
 * 与后端 ADR-0007 路由 + scope 对齐。
 */
export interface MCPServerSpec {
    /** mcpServers 配置里的 key（也是客户端识别名） */
    key: string;
    /** 显示名 */
    label: string;
    /** 后端端点路径 */
    endpoint: string;
    /** 能力描述（勾选时展示） */
    description: string;
    /** 该 server 涉及的 scope（用于提示 PAT 应包含哪些权限） */
    scopes: string[];
}

export const MCP_SERVERS: MCPServerSpec[] = [
    {
        key: "mimo-blog",
        label: "文章",
        endpoint: "/api/v1/mcp",
        description: "5 个文章 CRUD tool",
        scopes: ["posts:read", "posts:write", "posts:publish"],
    },
    {
        key: "mimo-blog-scraper",
        label: "抓取",
        endpoint: "/api/v1/mcp/scraper",
        description: "scrape_url + 7 个订阅 tool",
        scopes: ["posts:scrape", "subscriptions:read", "subscriptions:write"],
    },
];

/** PATDTO - 个人访问令牌读模型 */
export interface PATDTO {
    id: string;
    name: string;
    scopes: PATScope[];
    /** RFC3339，空表示永不过期 */
    expires_at?: string;
    /** RFC3339，空表示从未使用 */
    last_used_at?: string;
    created_at: string;
    /** 明文 token，仅创建响应返回（一次性） */
    token?: string;
}

/** CreatePATRequest - 创建 PAT 请求体 */
export interface CreatePATRequest {
    name: string;
    scopes: PATScope[];
    /** 默认 90d */
    expiry: PATExpiry;
}
