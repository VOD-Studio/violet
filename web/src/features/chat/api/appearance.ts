import { apiGet, apiPut } from "@shared/api/request";
import { parseAppearanceMap, parseAppearanceState } from "../lib/appearance";
import type { ChatAppearanceState } from "../model/appearance";

/** 复用既有 Axios 会话、CSRF、响应包裹与网络错误处理。 */
export async function fetchOwnAppearance(signal?: AbortSignal): Promise<ChatAppearanceState> {
	return parseAppearanceState(await apiGet<unknown>("/chat/appearance", { signal }));
}

/** 单次登录态批量查询,只返回公开装饰,绝不含账号设置。 */
export async function fetchAppearances(ids: readonly string[], signal?: AbortSignal) {
	const result = await apiGet<unknown>("/chat/appearances", {
		params: { user_ids: ids.join(",") },
		signal,
	});
	return parseAppearanceMap(result, ids);
}

/** 空字段即显式移除对应装饰;四个字段与最近读取的 revision 都必填。 */
export async function saveOwnAppearance(state: ChatAppearanceState): Promise<ChatAppearanceState> {
	return parseAppearanceState(await apiPut<unknown>("/chat/appearance", state));
}
