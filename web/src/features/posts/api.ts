/**
 * 文章功能 API 层
 * 使用 react-query 管理文章列表查询和单篇文章详情
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PostDetail, PaginatedPosts, PostsParams } from "./types";

/**
 * 获取文章列表
 * 支持分页、标签筛选和关键词搜索
 */
export function usePosts(params: PostsParams = {}) {
  const { page = 1, limit = 6, tag, search } = params;

  return useQuery({
    queryKey: ["posts", { page, limit, tag, search }],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("limit", String(limit));
      if (tag) searchParams.set("tag", tag);
      if (search) searchParams.set("search", search);
      return api.get<PaginatedPosts>(`/posts?${searchParams.toString()}`);
    },
  });
}

/**
 * 获取单篇文章详情
 * @param slug 文章 URL 别名
 */
export function usePost(slug: string | undefined) {
  return useQuery({
    queryKey: ["posts", slug],
    queryFn: () => api.get<PostDetail>(`/posts/${slug}`),
    enabled: !!slug,
  });
}

/**
 * 删除文章的 mutation hook
 */
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.del(`/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

/**
 * 增加文章浏览次数
 * @param id 文章 ID
 */
export function useIncrementView() {
  return useMutation({
    mutationFn: (id: string) => api.post(`/posts/${id}/view`),
  });
}
