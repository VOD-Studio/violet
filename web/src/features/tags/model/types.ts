/**
 * Tag - 标签读模型
 *
 * 对接后端 GET /api/v1/tags 与 POST /api/v1/tags 返回字段，
 * 对应后端 application/tag.TagDTO。
 */
export interface Tag {
    /** 标签 ID */
    id: number;
    /** 标签名 */
    name: string;
    /** URL 友好的 slug */
    slug: string;
}

/**
 * CreateTag - 创建标签请求体
 *
 * 对接后端 POST /api/v1/tags 的请求体 binding，仅 name 必填，
 * slug 由后端 GenerateSlug 自动生成。
 */
export interface CreateTag {
    /** 标签名，必填 */
    name: string;
}
