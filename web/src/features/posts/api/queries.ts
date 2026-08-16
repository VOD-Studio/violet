import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { Post, PostDetail, PostListQuery, PostSearchResult } from "../model/types";
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
 * useInfinitePosts - 无限加载的文章列表
 *
 * 触底翻页（offset 模式），total_pages 用尽后 hasNextPage 归 false。
 * 固定 limit，翻页 param 即页码。
 */
export const useInfinitePosts = (limit: number) =>
	useInfiniteQuery({
		queryKey: [...postKeys.all, "infinite", limit],
		queryFn: ({ pageParam }) => fetchPosts({ page: pageParam, limit }),
		initialPageParam: 1,
		getNextPageParam: (last) => {
			const page = last.pagination.page ?? 1;
			const total = last.pagination.total_pages ?? 1;
			return page < total ? page + 1 : undefined;
		},
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

/**
 * fetchSearchPosts - 调后端 GET /posts/search 公开搜索已发布文章
 *
 * @param q 关键词（title/excerpt/content 三列 ILIKE）
 */
export const fetchSearchPosts = async (
	q: string,
	limit = 8,
): Promise<PagedResponse<PostSearchResult>> =>
	apiGetPaged<PostSearchResult>("/posts/search", { params: { q, limit } });

/**
 * useSearchPosts - 前台公开搜索 hook
 *
 * q 去空格后长度 < 2 时不启用查询（避免单字符噪音）。
 */
export const useSearchPosts = (q: string) =>
	useQuery({
		queryKey: postKeys.search(q),
		queryFn: () => fetchSearchPosts(q),
		enabled: q.trim().length >= 2,
		staleTime: 60_000,
	});
