import type { UserDTO } from "../../entities/user/model/types";
import { getServerHttpClient } from "./auth";

/**
 * getCurrentUser - SSR 期间获取当前登录用户
 *
 * 转发浏览器 cookie 到后端 GET /auth/me：
 * - cookie 有效 → 返回 UserDTO
 * - cookie 无效/缺失 → 返回 null（不抛错，让页面正常渲染游客视图）
 *
 * 用于 __root 的 beforeLoad 注入 context.auth，使 SSR 阶段就能确定登录态，
 * 避免客户端 hydrate 后才发现未登录（避免闪烁/二次跳转）。
 *
 * 关键：失败时返回 null 而非抛错——SSR 不能因鉴权失败导致整页 500。
 *
 * @returns 当前用户，未登录或出错时返回 null
 */
export const getCurrentUser = async (): Promise<UserDTO | null> => {
	try {
		const client = getServerHttpClient();
		const res = await client.get<{ data: UserDTO }>("/auth/me");
		return res.data.data;
	} catch {
		return null;
	}
};
