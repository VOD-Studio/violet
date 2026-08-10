import type { UserDTO } from "@entities/user/model/types";
import { authKeys } from "@features/auth/api/keys";
import { useMe } from "@features/auth/api/queries";
import { AccountInfoSection } from "@features/profile/ui/AccountInfoSection";
import { PasswordSection } from "@features/profile/ui/PasswordSection";
import { ProfileInfoSection } from "@features/profile/ui/ProfileInfoSection";
import { ProfileShell } from "@features/profile/ui/ProfileShell";
import { isSessionActive } from "@shared/api/session";
import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * ProfilePage - 个人中心
 *
 * 布局：ProfileShell 接管（侧栏头像卡 + 三个 Tab）。
 * Tab 内容：
 *   - profile：个人资料（用户名 / 简介）
 *   - account：账户信息（只读：邮箱、角色、注册时间）
 *   - password：密码修改
 */
const ProfilePage = () => {
	const { data: user } = useMe();

	if (!user) {
		return null; // beforeLoad 已拦截未登录
	}

	return (
		<ProfileShell
			user={user}
			profile={<ProfileInfoSection user={user} />}
			account={<AccountInfoSection user={user} />}
			password={<PasswordSection />}
		/>
	);
};

/**
 * /profile - 个人中心（需登录）
 *
 * beforeLoad 在 SSR 期间即可根据 context.auth 重定向到 /login，
 * 不必等客户端 hydrate 才发现未登录（避免闪烁/二次跳转）。
 */
export const Route = createFileRoute("/profile/")({
	ssr: false,
	beforeLoad: ({ context, location }) => {
		// 页面刷新后所有内存状态清空（me 缓存、sessionActive 全失），唯一持久的
		// 登录态信号是 cookie。violet_csrf 非 HttpOnly，前端可读——有它说明后端
		// 下发过 session cookie，按已登录处理，真实过期交给 401 拦截器 + 组件处理。
		const hasAuthCookie =
			typeof window !== "undefined" && document.cookie.includes("violet_csrf=");
		const me = context.queryClient.getQueryData<UserDTO | null>(authKeys.me());
		if (!context.auth.isAuthenticated && !isSessionActive() && !me && !hasAuthCookie) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
				replace: true,
			});
		}
	},
	component: ProfilePage,
});
