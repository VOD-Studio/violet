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
		// context.auth.isAuthenticated 来自 getAuthSession（server function RPC），
		// RPC cookie 转发不可靠（SSR 地址配错/转发丢 cookie），刷新时经常假阴性。
		// 追加 me 缓存判定：useMe 缓存来自浏览器直连的 /auth/me（可靠），有数据说明确实登录过。
		// 三者（RPC 判定、sessionActive、me 缓存）任一为真就不踢，交给组件/401 处理。
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
