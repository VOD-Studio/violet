import type { EmojiUploadResult } from "@entities/emoji/model/types";
import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
    BatchUpdateGroupStatusRequest,
    BatchUpdateResult,
    CreateEmojiGroupRequest,
    CreateEmojiRequest,
    CreateResourceResult,
    UpdateEmojiGroupRequest,
    UpdateEmojiRequest,
} from "../model/types";
import { adminEmojiKeys } from "./keys";

/** useCreateEmojiGroup - 创建表情分组，POST /admin/emojis/groups */
export const useCreateEmojiGroup = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateEmojiGroupRequest) =>
            apiPost<CreateResourceResult>("/admin/emojis/groups", body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminEmojiKeys.adminGroupList() });
        },
    });
};

/** useUpdateEmojiGroup - 更新表情分组，PATCH /admin/emojis/groups/{id} */
export const useUpdateEmojiGroup = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: number; body: UpdateEmojiGroupRequest; name?: string }) =>
            apiPatch<null>(`/admin/emojis/groups/${id}`, body),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: adminEmojiKeys.adminGroupList() });
        },
    });
};

/** useBatchUpdateGroupStatus - 批量启用/禁用分组，PATCH /admin/emojis/groups/batch-status */
export const useBatchUpdateGroupStatus = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: BatchUpdateGroupStatusRequest) =>
            apiPatch<BatchUpdateResult>("/admin/emojis/groups/batch-status", body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminEmojiKeys.adminGroupList() });
        },
    });
};

/** useDeleteEmojiGroup - 删除表情分组，DELETE /admin/emojis/groups/{id} */
export const useDeleteEmojiGroup = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id }: { id: number }) => apiDelete<null>(`/admin/emojis/groups/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminEmojiKeys.adminGroupList() });
        },
    });
};

/** useCreateEmoji - 在分组内创建表情，POST /admin/emojis/groups/{id}/emojis */
export const useCreateEmoji = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId, body }: { groupId: number; body: CreateEmojiRequest }) =>
            apiPost<CreateResourceResult>(`/admin/emojis/groups/${groupId}/emojis`, body),
        onSuccess: (_data, { groupId }) => {
            qc.invalidateQueries({ queryKey: adminEmojiKeys.adminGroupEmojis(groupId) });
        },
    });
};

/**
 * useUploadEmoji - 上传表情图片，POST /uploads/emoji
 *
 * multipart/form-data，服务端嗅探真实 MIME 防伪造，返回相对 URL。
 * 文件不落库，仅返回 URL，故无需 invalidate。
 */
export const useUploadEmoji = () =>
    useMutation({
        mutationFn: async (file: File) => {
            const form = new FormData();
            form.append("file", file);
            return apiPost<EmojiUploadResult>("/uploads/emoji", form);
        },
    });

/** useUpdateEmoji - 更新表情，PATCH /admin/emojis/{id} */
export const useUpdateEmoji = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: number; groupId?: number; body: UpdateEmojiRequest }) =>
            apiPatch<null>(`/admin/emojis/${id}`, body),
        onSuccess: (_data, { groupId }) => {
            if (groupId) {
                qc.invalidateQueries({ queryKey: adminEmojiKeys.adminGroupEmojis(groupId) });
            }
        },
    });
};

/** useDeleteEmoji - 删除表情，DELETE /admin/emojis/{id} */
export const useDeleteEmoji = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id }: { id: number; groupId?: number }) =>
            apiDelete<null>(`/admin/emojis/${id}`),
        onSuccess: (_data, { groupId }) => {
            if (groupId) {
                qc.invalidateQueries({ queryKey: adminEmojiKeys.adminGroupEmojis(groupId) });
            }
        },
    });
};
