import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";
import type { Post, PostDetail, PostListQuery } from "../model/types";
import { postKeys } from "./keys";

/**
 * fetchPosts - 调后端 GET /posts 拉取已发布文章列表
 *
 * httpClient 已自动 withCredentials + 解 envelope，此处直接拿到 PagedResponse。
 *
 * @param query 分页与标签筛选
 * @returns 解包后的列表与分页元数据
 */
export const fetchPosts = async (query: PostListQuery = {}): Promise<PagedResponse<Post>> =>
    apiGetPaged<Post>("/posts", { params: query });

/**
 * usePosts - 文章列表 hook
 *
 * @param query 分页与标签筛选
 */
export const usePosts = (query: PostListQuery = {}) =>
    useQuery({
        queryKey: postKeys.list(query),
        queryFn: () => fetchPosts(query),
    });

/**
 * fetchPostBySlug - 调后端 GET /posts/{slug} 按 slug 获取文章详情
 *
 * @param slug 文章 slug
 */
export const fetchPostBySlug = async (slug: string): Promise<PostDetail> =>
    apiGet<PostDetail>(`/posts/${slug}`);

/**
 * usePost - 按 slug 获取文章详情 hook
 *
 * @param slug 文章 slug，传入空串时不启用查询
 */
export const usePost = (slug: string) =>
    useQuery({
        queryKey: postKeys.detail(slug),
        queryFn: () => fetchPostBySlug(slug),
        enabled: slug.length > 0,
    });
