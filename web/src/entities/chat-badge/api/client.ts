import { apiDelete, apiGet, apiPost } from "@shared/api/request";

/** 徽章持有记录的对外形态;awarded_by 为空表示系统授予。 */
export interface ChatBadgeGrant {
	/** 徽章目录 ID。 */
	badge_id: string;
	/** 授予时间(RFC3339)。 */
	awarded_at: string;
	/** 授予操作者用户 ID;为空表示系统授予。 */
	awarded_by?: string;
}

/** 管理端读取指定用户的持有记录,供授予对话框回显。 */
export async function fetchUserBadges(
	userID: string,
	signal?: AbortSignal,
): Promise<ChatBadgeGrant[]> {
	const result = await apiGet<unknown>("/admin/chat-badges/grants", {
		params: { user_id: userID },
		signal,
	});
	return parseGrants(result);
}

/** 批量授予;已持有的自动跳过。 */
export async function grantUserBadges(userID: string, badgeIDs: readonly string[]): Promise<void> {
	await apiPost("/admin/chat-badges/grants", { user_id: userID, badge_ids: badgeIDs });
}

/** 撤销一枚持有;展示侧在下次查询自动消失。 */
export async function revokeUserBadge(userID: string, badgeID: string): Promise<void> {
	await apiDelete(`/admin/chat-badges/grants/${userID}/${badgeID}`);
}

function parseGrants(value: unknown): ChatBadgeGrant[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(item): item is ChatBadgeGrant =>
			!!item &&
			typeof item === "object" &&
			typeof (item as ChatBadgeGrant).badge_id === "string" &&
			typeof (item as ChatBadgeGrant).awarded_at === "string",
	);
}
