import { apiGet } from "@shared/api/request";

/** 徽章持有记录;awarded_by 为空表示系统授予。 */
export interface OwnBadgeGrant {
	/** 徽章目录 ID。 */
	badge_id: string;
	/** 授予时间(RFC3339)。 */
	awarded_at: string;
	/** 授予操作者用户 ID;为空表示系统授予。 */
	awarded_by?: string;
}

/** 本人徽章持有记录,按授予时间升序;佩戴选择走 /chat/appearance,不在此保存。 */
export async function fetchOwnBadges(signal?: AbortSignal): Promise<OwnBadgeGrant[]> {
	const result = await apiGet<unknown>("/chat/badges", { signal });
	if (!Array.isArray(result)) return [];
	return result.filter(
		(item): item is OwnBadgeGrant =>
			!!item &&
			typeof item === "object" &&
			typeof (item as OwnBadgeGrant).badge_id === "string" &&
			typeof (item as OwnBadgeGrant).awarded_at === "string",
	);
}
