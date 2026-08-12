import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { FriendLinkListQuery, FriendLinkManualRequest } from "../model/types";
import * as api from "./client";
import { friendLinkKeys } from "./keys";

/** useFriendLinks - 后台友链列表 hook（按状态筛选，服务端分页） */
export const useFriendLinks = (query: FriendLinkListQuery = {}) =>
	useQuery({
		queryKey: friendLinkKeys.adminList(query),
		queryFn: () => api.listFriendLinks(query),
	});

/** usePendingFriendLinkCount - 待审核友链数量 hook（后台菜单角标用） */
export const usePendingFriendLinkCount = () =>
	useQuery({
		queryKey: friendLinkKeys.pendingCount(),
		queryFn: () => api.countPendingFriendLinks(),
	});

/** 友链变更后失效后台全部列表 + 待审核计数 */
const useInvalidateFriendLinks = () => {
	const qc = useQueryClient();
	return () => {
		qc.invalidateQueries({ queryKey: friendLinkKeys.adminLists() });
		qc.invalidateQueries({ queryKey: friendLinkKeys.pendingCount() });
	};
};

/**
 * 审核类 mutation hooks 的 mutationFn 一律在调用时传 id（mutate(id)），
 * 而不是 hook 创建时绑定——DataTable cell 回调按行触发，无法按行调 hook。
 */

/** useApproveFriendLink - 批准（pending → approved；rejected 改判 → approved） */
export const useApproveFriendLink = () => {
	const invalidate = useInvalidateFriendLinks();
	return useMutation({
		mutationFn: (id: string) => api.approveFriendLink(id),
		onSuccess: () => {
			invalidate();
			toast.success("已批准");
		},
		onError: (e: Error) => toast.error(`批准失败：${e.message}`),
	});
};

/** useRejectFriendLink - 拒绝（pending → rejected） */
export const useRejectFriendLink = () => {
	const invalidate = useInvalidateFriendLinks();
	return useMutation({
		mutationFn: (id: string) => api.rejectFriendLink(id),
		onSuccess: () => {
			invalidate();
			toast.success("已拒绝");
		},
		onError: (e: Error) => toast.error(`拒绝失败：${e.message}`),
	});
};

/** useDisableFriendLink - 下柜（approved → disabled） */
export const useDisableFriendLink = () => {
	const invalidate = useInvalidateFriendLinks();
	return useMutation({
		mutationFn: (id: string) => api.disableFriendLink(id),
		onSuccess: () => {
			invalidate();
			toast.success("已下柜");
		},
		onError: (e: Error) => toast.error(`下柜失败：${e.message}`),
	});
};

/** useRestoreFriendLink - 恢复（disabled → approved） */
export const useRestoreFriendLink = () => {
	const invalidate = useInvalidateFriendLinks();
	return useMutation({
		mutationFn: (id: string) => api.restoreFriendLink(id),
		onSuccess: () => {
			invalidate();
			toast.success("已恢复");
		},
		onError: (e: Error) => toast.error(`恢复失败：${e.message}`),
	});
};

/** useCreateFriendLink - 手动添加友链（直接 approved） */
export const useCreateFriendLink = () => {
	const invalidate = useInvalidateFriendLinks();
	return useMutation({
		mutationFn: (body: FriendLinkManualRequest) => api.createFriendLink(body),
		onSuccess: () => {
			invalidate();
			toast.success("友链已添加");
		},
		onError: (e: Error) => toast.error(`添加失败：${e.message}`),
	});
};

/** useUpdateFriendLink - 编辑友链字段/排序 */
export const useUpdateFriendLink = () => {
	const invalidate = useInvalidateFriendLinks();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: FriendLinkManualRequest }) =>
			api.updateFriendLink(id, body),
		onSuccess: () => {
			invalidate();
			toast.success("友链已更新");
		},
		onError: (e: Error) => toast.error(`更新失败：${e.message}`),
	});
};

/** useDeleteFriendLink - 物理删除友链 */
export const useDeleteFriendLink = () => {
	const invalidate = useInvalidateFriendLinks();
	return useMutation({
		mutationFn: (id: string) => api.deleteFriendLink(id),
		onSuccess: () => {
			invalidate();
			toast.success("友链已删除");
		},
		onError: (e: Error) => toast.error(`删除失败：${e.message}`),
	});
};
