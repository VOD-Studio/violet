/**
 * admin-mcp 模块类型定义
 *
 * 对齐后端 application/api_token.PATDTO（GET/POST /admin/api-tokens 返回）。
 * scope 取值与后端 domain/api_token 常量一致（read/write/publish/scrape）。
 */

/** PAT 可选 scope（与后端 domain/api_token.ScopePosts* 对齐） */
export const PAT_SCOPES = ["posts:read", "posts:write", "posts:publish", "posts:scrape"] as const;
export type PATScope = (typeof PAT_SCOPES)[number];

/** PAT 过期选项 */
export const PAT_EXPIRIES = ["90d", "365d", "never"] as const;
export type PATExpiry = (typeof PAT_EXPIRIES)[number];

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
