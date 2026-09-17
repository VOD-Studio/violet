import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChatBadgeGrant, fetchUserBadges, grantUserBadges, revokeUserBadge } from "./client";

/** 按 user_id 隔离缓存;授予/撤销只失效对应用户的键。 */
export const chatBadgeKeys = {
	user: (userID: string) => ["admin", "chat-badges", userID] as const,
};

/** 管理端读取指定用户的持有记录。 */
export function useUserBadges(userID: string, enabled: boolean) {
	return useQuery({
		queryKey: chatBadgeKeys.user(userID),
		queryFn: ({ signal }) => fetchUserBadges(userID, signal),
		enabled: enabled && Boolean(userID),
	});
}

/** 授予后以服务端返回的权威列表回填,不做乐观更新。 */
export function useGrantBadges(userID: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (badgeIDs: readonly string[]) => grantUserBadges(userID, badgeIDs),
		retry: false,
		onSuccess: () => client.invalidateQueries({ queryKey: chatBadgeKeys.user(userID) }),
	});
}

export function useRevokeBadge(userID: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (badgeID: string) => revokeUserBadge(userID, badgeID),
		retry: false,
		onSuccess: () => client.invalidateQueries({ queryKey: chatBadgeKeys.user(userID) }),
	});
}

export type { ChatBadgeGrant };
