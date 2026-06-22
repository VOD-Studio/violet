import ComingSoon from "@shared/ui/coming-soon";
import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * ProfilePage - 个人中心占位组件
 *
 * 首期未实装，仅显示 ComingSoon。
 * 鉴权流（beforeLoad）已实装作为后续所有需登录路由的模板。
 */
function ProfilePage() {
	return <ComingSoon title="个人中心" />;
}

/**
 * /profile - 个人中心（需登录）
 *
 * beforeLoad 在 SSR 期间即可根据 context.auth 重定向到 /login，
 * 不必等客户端 hydrate 才发现未登录（避免闪烁/二次跳转）。
 */
export const Route = createFileRoute("/profile/")({
	beforeLoad: ({ context, location }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
				replace: true,
			});
		}
	},
	component: ProfilePage,
});
