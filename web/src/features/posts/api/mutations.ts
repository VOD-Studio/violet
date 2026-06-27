import { apiDelete, apiPatch, apiPost, apiPut } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AdminPost, CreatePost, UpdatePost, UpdatePostStatus } from "../model/types";
import { postKeys } from "./keys";

/**
 * useIncrementView - 调后端 POST /posts/{id}/view 增加文章浏览次数
 *
 * 返回 null（后端 RespondNoContent），无需 invalidate，浏览量在下次详情请求时刷新。
 */
export const useIncrementView = () =>
    useMutation({
        mutationFn: (id: string) => apiPost<null>(`/posts/${id}/view`),
    });

/**
 * useCreatePost - 调后端 POST /admin/posts 创建文章
 *
 * 成功后失效后台文章列表缓存。
 */
export const useCreatePost = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreatePost) => apiPost<AdminPost>("/admin/posts", body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: postKeys.adminLists() });
        },
    });
};

/**
 * useUpdatePost - 调后端 PUT /admin/posts/{id} 更新文章
 *
 * 成功后失效对应后台详情与所有列表缓存。
 *
 * @param id 文章 ID
 */
export const useUpdatePost = (id: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: UpdatePost) => apiPut<null>(`/admin/posts/${id}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: postKeys.adminDetail(id) });
            qc.invalidateQueries({ queryKey: postKeys.adminLists() });
        },
    });
};

/**
 * useUpdatePostStatus - 调后端 PATCH /admin/posts/{id}/status 更新文章状态
 *
 * 成功后失效对应后台详情与所有列表缓存。
 *
 * @param id 文章 ID
 */
export const useUpdatePostStatus = (id: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: UpdatePostStatus) =>
            apiPatch<AdminPost>(`/admin/posts/${id}/status`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: postKeys.adminDetail(id) });
            qc.invalidateQueries({ queryKey: postKeys.adminLists() });
        },
    });
};

/**
 * useDeletePost - 调后端 DELETE /admin/posts/{id} 删除文章
 *
 * 成功后失效所有后台文章缓存。
 *
 * @param id 文章 ID
 */
export const useDeletePost = (id: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => apiDelete<null>(`/admin/posts/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: postKeys.admin() });
        },
    });
};
