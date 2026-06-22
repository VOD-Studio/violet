import { httpClient } from "@shared/api/http";
import type { PagedResponse } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";
import type { Post, PostListQuery } from "../model/types";
import { postKeys } from "./keys";

/**
 * fetchPosts - 调后端 GET /api/v1/posts 拉取已发布文章列表
 *
 * httpClient 已自动 withCredentials + 解 envelope，此处直接拿到 PagedResponse。
 *
 * @param query 分页与标签筛选
 * @returns 解包后的列表 + 分页元数据
 */
export const fetchPosts = async (
	query: PostListQuery = {},
): Promise<PagedResponse<Post>> => {
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
