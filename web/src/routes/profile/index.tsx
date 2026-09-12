import type { UserDTO } from "@entities/user/model/types";
import { authKeys } from "@features/auth/api/keys";
import { useMe } from "@features/auth/api/queries";
import { AccountInfoSection } from "@features/profile/ui/AccountInfoSection";
import { ConnectionsSection } from "@features/profile/ui/ConnectionsSection";
import { PasswordSection } from "@features/profile/ui/PasswordSection";
import { ProfileInfoSection } from "@features/profile/ui/ProfileInfoSection";
import { ProfileShell } from "@features/profile/ui/ProfileShell";
import { isSessionActive } from "@shared/api/session";
import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * ProfilePage - 个人中心
 *
 * 布局：ProfileShell 接管（侧栏头像卡 + 两个 Tab）。
 * Tab 内容：
 *   - profile：个人资料（用户名 / 显示名 / 简介）
 *   - security：账户与安全（账号信息 / 登录方式 / 密码）
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
			security={
				<div className="space-y-6">
					<AccountInfoSection user={user} />
					<ConnectionsSection user={user} />
					<PasswordSection hasPassword={user.has_password} />
				</div>
			}
		/>
	);
};

/** 未登录时跳转登录页，并携带原页面作为回跳地址。 */
export const Route = createFileRoute("/profile/")({
	ssr: false,
	beforeLoad: ({ context, location }) => {
		const me = context.queryClient.getQueryData<UserDTO | null>(authKeys.me());
		if (!context.auth.isAuthenticated && !isSessionActive() && !me) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
				replace: true,
			});
		}
	},
	component: ProfilePage,
});
