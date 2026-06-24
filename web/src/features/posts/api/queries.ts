import { httpClient } from "@shared/api/http";
import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";
import type {
	AdminPost,
	AdminPostListQuery,
	Post,
	PostDetail,
	PostListQuery,
} from "../model/types";
import { postKeys } from "./keys";

/**
 * fetchPosts - 调后端 GET /posts 拉取已发布文章列表
 *
 * httpClient 已自动 withCredentials + 解 envelope，此处直接拿到 PagedResponse。
 *
 * @param query 分页与标签筛选
 * @returns 解包后的列表 + 分页元数据
 */
export const fetchPosts = async (query: PostListQuery = {}): Promise<PagedResponse<Post>> => {
	const res = await httpClient.get<PagedResponse<Post>>("/posts", {
		params: query,
	});
	return res.data;
};

/**
 * usePosts - 文章列表 hook
 *
 * 自动：
 * - 缓存（key 由 query 参数决定，切换筛选/页码自动重新请求）
 * - 网络错误重试 2 次（QueryClient 默认）
 * - 业务 4xx 不重试
 * - staleTime 60s（QueryClient 默认）
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

/**
 * fetchAdminPosts - 调后端 GET /admin/posts 拉取所有文章列表
 *
 * @param query 分页与状态筛选
 */
export const fetchAdminPosts = async (
	query: AdminPostListQuery = {},
): Promise<PagedResponse<AdminPost>> => apiGetPaged<AdminPost>("/admin/posts", { params: query });

/**
 * useAdminPosts - 后台文章列表 hook
 *
 * @param query 分页与状态筛选
 */
export const useAdminPosts = (query: AdminPostListQuery = {}) =>
	useQuery({
		queryKey: postKeys.adminList(query),
		queryFn: () => fetchAdminPosts(query),
	});

/**
 * fetchAdminPost - 调后端 GET /admin/posts/{id} 按 ID 获取文章详情
 *
 * @param id 文章 ID
 */
export const fetchAdminPost = async (id: string): Promise<AdminPost> =>
	apiGet<AdminPost>(`/admin/posts/${id}`);

/**
 * useAdminPost - 后台文章详情 hook
 *
 * @param id 文章 ID，传入空串时不启用查询
 */
export const useAdminPost = (id: string) =>
	useQuery({
		queryKey: postKeys.adminDetail(id),
		queryFn: () => fetchAdminPost(id),
		enabled: id.length > 0,
	});
