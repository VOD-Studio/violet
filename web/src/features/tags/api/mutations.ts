import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateTag, Tag, UpdateTagRequest } from "../model/types";
import { tagKeys } from "./keys";

/**
 * useCreateTag - 创建标签 mutation
 *
 * 对接 POST /api/v1/tags，成功后 invalidate 标签列表使缓存自动刷新。
 */
export const useCreateTag = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateTag) => apiPost<Tag>("/tags", body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
        },
    });
};

/**
 * useUpdateTag - 更新标签 mutation
 *
 * 对接 PATCH /api/v1/tags/{id}，成功后 invalidate 标签列表使缓存自动刷新。
 */
export const useUpdateTag = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: number; body: UpdateTagRequest }) =>
            apiPatch<Tag>(`/tags/${id}`, body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
        },
    });
};

/**
 * useDeleteTag - 删除标签 mutation
 *
 * 对接 DELETE /api/v1/tags/{id}，后端返回消息信封 data 为 null。
 * 成功后 invalidate 标签列表使缓存自动刷新。
 *
 * @param id 标签 ID
 */
export const useDeleteTag = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => apiDelete<null>(`/tags/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
        },
    });
};
