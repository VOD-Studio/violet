/**
 * Tag - 标签领域实体
 *
 * 前台标签展示与后台标签管理共享的读模型，跨 feature 复用故归 entities 层，
 * 放置惯例对齐 entities/user、entities/post。
 */

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
