/**
 * admin-announcements TanStack Query Hooks
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateAnnouncementRequest, UpdateAnnouncementRequest } from "../model/types";
import * as api from "./client";
import { announcementKeys } from "./keys";

/**
 * useAdminAnnouncements - 查询公告列表
 */
export const useAdminAnnouncements = () =>
	useQuery({
		queryKey: announcementKeys.list(),
		queryFn: () => api.listAnnouncements(),
	});

/**
 * useCreateAnnouncement - 创建公告 mutation
 */
export const useCreateAnnouncement = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateAnnouncementRequest) => api.createAnnouncement(body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: announcementKeys.lists() });
			toast.success("公告创建成功");
		},
		onError: (e: Error) => toast.error(`创建公告失败：${e.message}`),
	});
};

/**
 * useUpdateAnnouncement - 更新公告 mutation
 */
export const useUpdateAnnouncement = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, body }: { id: number; body: UpdateAnnouncementRequest }) =>
			api.updateAnnouncement(id, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: announcementKeys.lists() });
			toast.success("公告更新成功");
		},
		onError: (e: Error) => toast.error(`更新公告失败：${e.message}`),
	});
};

/**
 * useDeleteAnnouncement - 删除公告 mutation
 */
export const useDeleteAnnouncement = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => api.deleteAnnouncement(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: announcementKeys.lists() });
			toast.success("公告删除成功");
		},
		onError: (e: Error) => toast.error(`删除公告失败：${e.message}`),
	});
};
