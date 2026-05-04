// 文章管理 API Hooks
// 使用 react-query 管理文章相关的 API 调用

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { postKeys } from "./queryKeys";
import type {
  ApiPost,
  PostListParams,
  PostListResponse,
  PostFormData,
  PostStatus,
} from "./types";

/**
 * 获取后台文章列表
 */
export function useAdminPosts(params: PostListParams = {}) {
  const { page = 1, limit = 10, status } = params;

  return useQuery({
    queryKey: postKeys.list({ page, limit, status }),
    queryFn: () => {
      const queryParams = new URLSearchParams();
      queryParams.set("page", String(page));
      queryParams.set("limit", String(limit));
      if (status) queryParams.set("status", status);
      return api.get<PostListResponse>(`/posts?${queryParams.toString()}`);
    },
  });
}

/**
 * 切换文章发布状态的 mutation
 */
export function useTogglePostStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PostStatus }) =>
      api.patch(`/posts/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.all });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

/**
 * 删除文章的 mutation
 */
export function useDeleteAdminPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.del(`/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.all });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

/**
 * 文章保存 mutation hook
 */
export function useSavePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, id }: { data: PostFormData; id?: string }) => {
      if (id) {
        return api.put<ApiPost>(`/posts/${id}`, data);
      }
      return api.post<ApiPost>("/posts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.all });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}
