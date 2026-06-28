import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
    BatchUpdateGroupStatusRequest,
    BatchUpdateResult,
    CreateEmojiGroupRequest,
    CreateEmojiRequest,
    CreateResourceResult,
    EmojiUploadResult,
    UpdateEmojiGroupRequest,
    UpdateEmojiRequest,
} from "../model/types";
import { emojiKeys } from "./keys";

/**
 * useCreateEmojiGroup - 创建表情分组
 *
 * 调后端 POST /admin/emojis/groups，成功后失效后台分组列表与公开列表，
 * 保证前台公开查询同步看到新分组（若创建为启用状态）。
 */
export const useCreateEmojiGroup = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateEmojiGroupRequest) =>
            apiPost<CreateResourceResult>("/admin/emojis/groups", body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: emojiKeys.adminGroupList() });
            qc.invalidateQueries({ queryKey: emojiKeys.publicGroupList() });
        },
    });
};

/**
 * useUpdateEmojiGroup - 更新表情分组
 *
 * 调后端 PATCH /admin/emojis/groups/{id}，部分更新分组字段。
 * 失效后台列表、公开列表，以及该分组按名查询的缓存。
 * id/name 在 mutate({ id, name, body }) 时传入（模式 B，避免可变参数绑死 hook）。
 */
export const useUpdateEmojiGroup = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: number; body: UpdateEmojiGroupRequest; name?: string }) =>
            apiPatch<null>(`/admin/emojis/groups/${id}`, body),
        onSuccess: async (_data, { name }) => {
            await qc.invalidateQueries({ queryKey: emojiKeys.adminGroupList() });
            await qc.invalidateQueries({ queryKey: emojiKeys.publicGroupList() });
            if (name) {
                await qc.invalidateQueries({ queryKey: emojiKeys.publicGroupByName(name) });
            }
        },
    });
};

/**
 * useBatchUpdateGroupStatus - 批量启用/禁用分组
 *
 * 调后端 PATCH /admin/emojis/groups/batch-status，批量切换启用状态。
 * 失效后台与公开列表，公开列表可能因启用状态变化而增减项。
 */
export const useBatchUpdateGroupStatus = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: BatchUpdateGroupStatusRequest) =>
            apiPatch<BatchUpdateResult>("/admin/emojis/groups/batch-status", body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: emojiKeys.adminGroupList() });
            qc.invalidateQueries({ queryKey: emojiKeys.publicGroupList() });
        },
    });
};

/**
 * useDeleteEmojiGroup - 删除表情分组
 *
 * 调后端 DELETE /admin/emojis/groups/{id}，分组内表情一并级联删除。
 * 失效后台与公开列表。id 在 mutate({ id }) 时传入（模式 B）。
 */
export const useDeleteEmojiGroup = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id }: { id: number }) => apiDelete<null>(`/admin/emojis/groups/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: emojiKeys.adminGroupList() });
            qc.invalidateQueries({ queryKey: emojiKeys.publicGroupList() });
        },
    });
};

/**
 * useCreateEmoji - 在分组内创建表情
 *
 * 调后端 POST /admin/emojis/groups/{id}/emojis，新建表情记录。
 * 失效该分组内表情列表与公开列表，公开侧需同步新表情。
 * groupId 在 mutate({ groupId, body }) 时传入（模式 B）。
 */
export const useCreateEmoji = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId, body }: { groupId: number; body: CreateEmojiRequest }) =>
            apiPost<CreateResourceResult>(`/admin/emojis/groups/${groupId}/emojis`, body),
        onSuccess: (_data, { groupId }) => {
            qc.invalidateQueries({ queryKey: emojiKeys.adminGroupEmojis(groupId) });
            qc.invalidateQueries({ queryKey: emojiKeys.publicGroupList() });
        },
    });
};

/**
 * useUploadEmoji - 上传表情图片
 *
 * 调后端 POST /admin/emojis/upload，multipart/form-data 上传图片文件。
 * 服务端嗅探真实 MIME 防伪造，返回相对 URL 供后续 CreateEmoji 引用。
 * 文件不落库，仅返回 URL，故无需 invalidate 任何查询。
 *
 * @param file 待上传的表情图片文件
 */
export const useUploadEmoji = () =>
    useMutation({
        mutationFn: async (file: File) => {
            const form = new FormData();
            form.append("file", file);
            return apiPost<EmojiUploadResult>("/admin/emojis/upload", form);
        },
    });

/**
 * useUpdateEmoji - 更新表情
 *
 * 调后端 PATCH /admin/emojis/emojis/{id}，更新表情字段。
 * 失效该表情所属分组的表情列表与公开列表。id/groupId 在 mutate
 * ({ id, groupId, body }) 时传入（模式 B），避免可变 id 绑死 hook。
 */
export const useUpdateEmoji = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: number; groupId?: number; body: UpdateEmojiRequest }) =>
            apiPatch<null>(`/admin/emojis/emojis/${id}`, body),
        onSuccess: (_data, { groupId }) => {
            if (groupId) {
                qc.invalidateQueries({ queryKey: emojiKeys.adminGroupEmojis(groupId) });
            }
            qc.invalidateQueries({ queryKey: emojiKeys.publicGroupList() });
        },
    });
};

/**
 * useDeleteEmoji - 删除表情
 *
 * 调后端 DELETE /admin/emojis/emojis/{id}，删除单条表情记录。
 * 失效该表情所属分组的表情列表与公开列表。id/groupId 在
 * mutate({ id, groupId }) 时传入（模式 B）。
 */
export const useDeleteEmoji = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id }: { id: number; groupId?: number }) =>
            apiDelete<null>(`/admin/emojis/emojis/${id}`),
        onSuccess: (_data, { groupId }) => {
            if (groupId) {
                qc.invalidateQueries({ queryKey: emojiKeys.adminGroupEmojis(groupId) });
            }
            qc.invalidateQueries({ queryKey: emojiKeys.publicGroupList() });
        },
    });
};
