/** notifications feature 查询与 mutation hooks */

import {
	fetchNotifications,
	fetchUnreadCount,
	markAllNotificationsRead,
	markNotificationRead,
	type NotificationItem,
} from "@shared/api/notifications";
import type { PagedResponse } from "@shared/api/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationKeys } from "./keys";

const PAGE_SIZE = 20;

/** useNotifications - 通知列表 hook（分页） */
export const useNotifications = (page = 1, limit = PAGE_SIZE) =>
	useQuery({
		queryKey: [...notificationKeys.list, { page, limit }],
		queryFn: () => fetchNotifications(page, limit),
	});

/** useUnreadCount - 未读计数 hook */
export const useUnreadCount = () =>
	useQuery({
		queryKey: notificationKeys.unreadCount,
		queryFn: () => fetchUnreadCount(),
		refetchInterval: 60_000,
	});

/** useMarkNotificationRead - 标记单条已读（乐观更新） */
export const useMarkNotificationRead = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => markNotificationRead(id),
		onMutate: async (id: string) => {
			await qc.cancelQueries({ queryKey: notificationKeys.all });
			qc.setQueryData<PagedResponse<NotificationItem>>(
				[...notificationKeys.list, { page: 1, limit: 10 }],
				(old) =>
					old
						? {
								...old,
								data: old.data.map((n) =>
									n.id === id ? { ...n, is_read: true } : n,
								),
							}
						: old,
			);
			qc.setQueryData<{ unread_count: number }>(notificationKeys.unreadCount, (old) =>
				old ? { unread_count: Math.max(0, old.unread_count - 1) } : old,
			);
		},
		onSettled: () => {
			qc.invalidateQueries({ queryKey: notificationKeys.all });
		},
	});
};

/** useMarkAllRead - 标记全部已读（乐观更新） */
export const useMarkAllRead = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => markAllNotificationsRead(),
		onMutate: async () => {
			await qc.cancelQueries({ queryKey: notificationKeys.all });
			qc.setQueryData<PagedResponse<NotificationItem>>(
				[...notificationKeys.list, { page: 1, limit: 10 }],
				(old) =>
					old ? { ...old, data: old.data.map((n) => ({ ...n, is_read: true })) } : old,
			);
			qc.setQueryData<{ unread_count: number }>(notificationKeys.unreadCount, () => ({
				unread_count: 0,
			}));
		},
		onSettled: () => {
			qc.invalidateQueries({ queryKey: notificationKeys.all });
		},
	});
};
