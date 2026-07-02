import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";
import type {
    AdminPost,
    AdminPostListItem,
    AdminPostListQuery,
    PostVersionDTO,
} from "../model/types";
import { adminPostKeys } from "./keys";

/**
 * fetchAdminPosts - 调后端 GET /admin/posts 拉取所有文章列表
 *
 * @param query 分页与状态筛选
 */
export const fetchAdminPosts = async (
    query: AdminPostListQuery = {},
): Promise<PagedResponse<AdminPostListItem>> =>
    apiGetPaged<AdminPostListItem>("/admin/posts", { params: query });

/**
 * useAdminPosts - 后台文章列表 hook
 *
 * @param query 分页与状态筛选
 */
export const useAdminPosts = (query: AdminPostListQuery = {}) =>
    useQuery({
        queryKey: adminPostKeys.list(query),
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
        queryKey: adminPostKeys.detail(id),
        queryFn: () => fetchAdminPost(id),
        enabled: id.length > 0,
    });

export function usePostVersions(postId: string) {
    return useQuery({
        queryKey: adminPostKeys.versions(postId),
        queryFn: async () => {
            return await apiGet<PostVersionDTO[]>(`/admin/posts/${postId}/versions`);
        },
        enabled: !!postId,
    });
}

export function usePostVersion(versionId: string) {
    return useQuery({
        queryKey: adminPostKeys.version(versionId),
        queryFn: async () => {
            return await apiGet<PostVersionDTO>(`/admin/posts/versions/${versionId}`);
        },
        enabled: !!versionId,
        staleTime: Infinity,
    });
}
