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
		if (!context.auth.isAuthenticated && !isSessionActive()) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
				replace: true,
			});
		}
	},
	component: ProfilePage,
});
