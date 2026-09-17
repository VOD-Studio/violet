import type { ChatAppearance, ChatAppearanceState } from "../model/appearance";
import { MAX_EQUIPPED_BADGES } from "../model/appearance";
import {
	BADGE_BY_ID,
	BUBBLE_BY_ID,
	CHARM_BY_ID,
	EMPTY_APPEARANCE,
	FRAME_BY_ID,
} from "../model/appearance-catalog";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 用户键保证确定性、单请求有上界,并可安全序列化进 URL。 */
export function normalizeAppearanceUserIDs(ids: readonly string[]): string[] {
	return [
		...new Set(
			ids
				.map((id) => id.toLowerCase())
				.filter(
					(id) => UUID_PATTERN.test(id) && id !== "00000000-0000-0000-0000-000000000000",
				),
		),
	].sort();
}

/** 把可见用户切成服务端上限大小的批次,而不是每条消息各查一次。 */
export function appearanceBatches(ids: readonly string[]): string[][] {
	const values = normalizeAppearanceUserIDs(ids);
	const batches: string[][] = [];
	for (let i = 0; i < values.length; i += 50) batches.push(values.slice(i, i + 50));
	return batches;
}

/** 未知的目录 ID 各自独立兜底,含主题下架后遗留的过期偏好。 */
export function normalizeAppearance(value: unknown): ChatAppearance {
	if (!value || typeof value !== "object") return { ...EMPTY_APPEARANCE };
	const input = value as Record<string, unknown>;
	const known = (key: string, lookup: ReadonlyMap<string, unknown>): string => {
		const id = input[key];
		return typeof id === "string" && lookup.has(id) ? id : "";
	};
	// 佩戴列表整体去重截断;单枚合法性由目录查表兜底,持有校验在服务端。
	const badgeIDs = Array.isArray(input.badge_ids)
		? [
				...new Set(
					input.badge_ids.filter(
						(id): id is string => typeof id === "string" && BADGE_BY_ID.has(id),
					),
				),
			].slice(0, MAX_EQUIPPED_BADGES)
		: [];
	return {
		avatar_frame_id: known("avatar_frame_id", FRAME_BY_ID),
		avatar_charm_id: known("avatar_charm_id", CHARM_BY_ID),
		bubble_theme_id: known("bubble_theme_id", BUBBLE_BY_ID),
		badge_ids: badgeIDs,
	};
}

/** 保存前先校验 revision;加载失败绝不能变成零版本覆写。 */
export function parseAppearanceState(value: unknown): ChatAppearanceState {
	if (
		!value ||
		typeof value !== "object" ||
		!("revision" in value) ||
		!Number.isSafeInteger(value.revision) ||
		Number(value.revision) < 0
	) {
		throw new Error("聊天外观响应格式错误，请重试");
	}
	return { ...normalizeAppearance(value), revision: Number(value.revision) };
}

/** 批量响应里只认请求过的用户,且绝不信任返回的资源路径。 */
export function parseAppearanceMap(
	value: unknown,
	ids: readonly string[],
): Record<string, ChatAppearance> {
	const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
	return Object.fromEntries(ids.map((id) => [id, normalizeAppearance(input[id])]));
}

/** 只比较落库的外观字段,不含 revision。 */
export function sameAppearance(a: ChatAppearance, b: ChatAppearance): boolean {
	return (
		a.avatar_frame_id === b.avatar_frame_id &&
		a.avatar_charm_id === b.avatar_charm_id &&
		a.bubble_theme_id === b.bubble_theme_id &&
		a.badge_ids.length === b.badge_ids.length &&
		a.badge_ids.every((id, index) => id === b.badge_ids[index])
	);
}

/** 错误信息在编辑器内可见;冲突不得静默覆盖草稿。 */
export function appearanceErrorMessage(error: unknown): string {
	if (error && typeof error === "object" && "status" in error && error.status === 409) {
		return "其他设备已修改外观。当前草稿仍保留；点击“重新加载”后再选择并保存。";
	}
	return error instanceof Error ? error.message : "外观保存失败，请检查网络后重试。";
}
