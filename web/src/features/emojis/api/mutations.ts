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
 *
 * @param id 分组 ID
 * @param name 分组名称，用于invalidate 按名查询缓存，可选
 */
export const useUpdateEmojiGroup = (id: number, name?: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: UpdateEmojiGroupRequest) =>
			apiPatch<null>(`/admin/emojis/groups/${id}`, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: emojiKeys.adminGroupList() });
			qc.invalidateQueries({ queryKey: emojiKeys.publicGroupList() });
			if (name) {
				qc.invalidateQueries({
					queryKey: emojiKeys.publicGroupByName(name),
				});
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
 * 失效后台与公开列表。
 *
 * @param id 分组 ID
 */
export const useDeleteEmojiGroup = (id: number) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => apiDelete<null>(`/admin/emojis/groups/${id}`),
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
 *
 * @param groupId 分组 ID
 */
export const useCreateEmoji = (groupId: number) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateEmojiRequest) =>
			apiPost<CreateResourceResult>(
				`/admin/emojis/groups/${groupId}/emojis`,
				body,
			),
		onSuccess: () => {
			qc.invalidateQueries({
				queryKey: emojiKeys.adminGroupEmojis(groupId),
			});
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
 * 失效该表情所属分组的表情列表与公开列表。groupId 用于精准 invalidate，
 * 未提供时仅失效公开列表，后台分组内列表由列表级 invalidate 兜底。
 *
 * @param id 表情 ID
 * @param groupId 所属分组 ID，可选，用于精准失效后台分组内列表
 */
export const useUpdateEmoji = (id: number, groupId?: number) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: UpdateEmojiRequest) =>
			apiPatch<null>(`/admin/emojis/emojis/${id}`, body),
		onSuccess: () => {
			if (groupId) {
				qc.invalidateQueries({
					queryKey: emojiKeys.adminGroupEmojis(groupId),
				});
			}
			qc.invalidateQueries({ queryKey: emojiKeys.publicGroupList() });
		},
	});
};

/**
 * useDeleteEmoji - 删除表情
 *
 * 调后端 DELETE /admin/emojis/emojis/{id}，删除单条表情记录。
 * 失效该表情所属分组的表情列表与公开列表。
 *
 * @param id 表情 ID
 * @param groupId 所属分组 ID，可选，用于精准失效后台分组内列表
 */
export const useDeleteEmoji = (id: number, groupId?: number) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => apiDelete<null>(`/admin/emojis/emojis/${id}`),
		onSuccess: () => {
			if (groupId) {
				qc.invalidateQueries({
					queryKey: emojiKeys.adminGroupEmojis(groupId),
				});
			}
			qc.invalidateQueries({ queryKey: emojiKeys.publicGroupList() });
		},
	});
};
