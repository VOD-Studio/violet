import { clientQueryClient as queryClient } from "@shared/api/query-client";
import { apiDelete, apiPatch, apiPost, apiPut } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
    AdminPost,
    CreatePost,
    SetFeatured,
    UpdatePost,
    UpdatePostStatus,
} from "../model/types";
import { adminPostKeys } from "./keys";

/** useInvalidateAdminPosts - 失效后台文章全部列表与详情缓存 */
const useInvalidateAdminPosts = () => {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: adminPostKeys.lists() });
        qc.invalidateQueries({ queryKey: adminPostKeys.details() });
    };
};

/**
 * useCreatePost - 调后端 POST /admin/posts 创建文章
 *
 * 成功后失效后台文章缓存。成功提示由调用方按上下文给出，故此处不 toast。
 */
export const useCreatePost = () => {
    const invalidate = useInvalidateAdminPosts();
    return useMutation({
        mutationFn: (body: CreatePost) => apiPost<AdminPost>("/admin/posts", body),
        onSuccess: () => invalidate(),
    });
};

/**
 * useUpdatePost - 调后端 PUT /admin/posts/{id} 更新文章
 *
 * @param id 文章 ID
 */
export const useUpdatePost = (id: string) => {
    const invalidate = useInvalidateAdminPosts();
    return useMutation({
        mutationFn: (body: UpdatePost) => apiPut<null>(`/admin/posts/${id}`, body),
        onSuccess: () => invalidate(),
    });
};

/**
 * useUpdatePostStatus - 调后端 PATCH /admin/posts/{id}/status 更新文章状态
 *
 * @param id 文章 ID
 */
export const useUpdatePostStatus = (id: string) => {
    const invalidate = useInvalidateAdminPosts();
    return useMutation({
        mutationFn: (body: UpdatePostStatus) =>
            apiPatch<AdminPost>(`/admin/posts/${id}/status`, body),
        onSuccess: () => invalidate(),
    });
};

/**
 * useSetFeatured - 调后端 PATCH /admin/posts/{id}/featured 切换精选标记
 *
 * @param id 文章 ID
 */
export const useSetFeatured = (id: string) => {
    const invalidate = useInvalidateAdminPosts();
    return useMutation({
        mutationFn: (body: SetFeatured) => apiPatch<AdminPost>(`/admin/posts/${id}/featured`, body),
        onSuccess: () => invalidate(),
    });
};

/**
 * useDeletePost - 调后端 DELETE /admin/posts/{id} 删除文章
 *
 * @param id 文章 ID
 */
export const useDeletePost = (id: string) => {
    const invalidate = useInvalidateAdminPosts();
    return useMutation({
        mutationFn: () => apiDelete<null>(`/admin/posts/${id}`),
        onSuccess: () => invalidate(),
    });
};

/**
 * publishPost - 调状态切换接口发布文章
 *
 * Create 接口恒为草稿，发布走 PATCH /admin/posts/{id}/status。
 * 用裸 apiPatch 以便在 mutation onSuccess 回调里调用，手动失效缓存。
 */
export async function publishPost(id: string): Promise<void> {
    await apiPatch<AdminPost>(`/admin/posts/${id}/status`, { status: "published" });
    queryClient.invalidateQueries({ queryKey: adminPostKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: adminPostKeys.lists() });
}

/** ImportPostUrlResult - 远程链接文档解析结果 */
export interface ImportPostUrlResult {
    /** 网页标题，可为空 */
    title?: string;
    /** 提取出的正文 HTML */
    html: string;
}

/**
 * importPostUrl - 调后端 POST /admin/posts/import-url 解析远程链接正文
 *
 * 后端 readability 代理解析，返回标题与正文 HTML，供编辑器 setContent 插入。
 */
export async function importPostUrl(url: string): Promise<ImportPostUrlResult> {
    return apiPost<ImportPostUrlResult>("/admin/posts/import-url", { url });
}
