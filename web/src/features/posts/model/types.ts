/**
 * posts 模块前台类型
 *
 * 领域读模型 Post、PostDetail 见 entities/post，此处转出供前台 slice 内部消费。
 * 后台写操作与查询类型见 features/admin-posts。
 */
export type { Post, PostDetail } from "@entities/post/model/types";

/**
 * PostListQuery - 文章列表查询参数
 */
export interface PostListQuery {
    /** 页码，从 1 开始 */
    page?: number;
    /** 每页条数 */
    limit?: number;
    /** 标签筛选 */
    tag?: string;
}
