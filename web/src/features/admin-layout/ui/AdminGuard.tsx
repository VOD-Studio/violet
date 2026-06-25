import type { UserDTO } from "@entities/user/model/types";
import { redirect } from "@tanstack/react-router";

/**
 * requireAdmin - 校验当前用户是否为管理员
 *
 * 用于路由 beforeLoad。非管理员或未登录时重定向到 /login。
 *
 * @param user 当前登录用户
 * @param href 当前路径，用于登录后回跳
 */
export function requireAdmin(user: UserDTO | null, href: string): void {
	if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
		throw redirect({
			to: "/login",
			search: { redirect: href },
			replace: true,
		});
	}
}
