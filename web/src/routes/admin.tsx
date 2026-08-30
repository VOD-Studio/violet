import type { UserDTO } from "@entities/user/model/types";
import { AdminSidebar } from "@features/admin-layout/ui/AdminSidebar";
import { AdminTopBar } from "@features/admin-layout/ui/AdminTopBar";
import { authKeys } from "@features/auth/api/keys";
import { fetchMe } from "@features/auth/api/queries";
import { isSessionActive } from "@shared/api/session";
import {
	createFileRoute,
	isRedirect,
	Outlet,
	redirect,
	useRouterState,
} from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
	ssr: false,
	beforeLoad: async ({ context }) => {
		const { auth, queryClient } = context;

		// 页面刷新后内存状态全失，violet_csrf cookie 是唯一持久的登录态信号。
		const hasAuthCookie =
			typeof window !== "undefined" && document.cookie.includes("violet_csrf=");
		const meCache = queryClient.getQueryData<UserDTO | null>(authKeys.me());
		if (
			(!auth.isAuthenticated || !auth.claims) &&
			!isSessionActive() &&
			!meCache &&
			!hasAuthCookie
		) {
			throw redirect({
				to: "/",
				replace: true,
			});
		}

		// 检查用户是否有后台访问权限（admin:access）。
		// claims 不含权限数组，经 queryClient 取 /auth/me（与 useMe 同缓存键，自动复用）。
		// 超管 me.permissions 含通配 "*"，直接放行。
		if (auth.claims) {
			let me: UserDTO | undefined;
			try {
				me = await queryClient.ensureQueryData({
					queryKey: authKeys.me(),
					queryFn: fetchMe,
					staleTime: Infinity,
				});
			} catch (e) {
				// ensureQueryData 失败（网络/401）→ 无后台权限
				if (isRedirect(e)) throw e;
				throw redirect({ to: "/", replace: true });
			}
			const perms = me?.permissions ?? [];
			const hasAccess = perms.includes("*") || perms.includes("admin:access");
			if (!hasAccess) {
				throw redirect({ to: "/", replace: true });
			}
		}
	},
	component: AdminLayout,
});

/** 根据当前路由路径解析 TopBar 标题 */
function useAdminTitle(): string {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	if (pathname === "/admin") return "概览";
	if (pathname.startsWith("/admin/users")) return "用户管理";
	if (pathname.startsWith("/admin/emojis")) return "表情管理";
	if (pathname.startsWith("/admin/system")) return "系统监控";
	if (pathname.startsWith("/admin/posts")) return "文章管理";
	if (pathname.startsWith("/admin/series")) return "系列书管理";
	if (pathname.startsWith("/admin/galleries")) return "图集管理";
	return "后台管理";
}

/**
 * /admin - 后台布局
 *
 * 桌面侧边栏（AdminSidebar）+ 移动抽屉（AdminMobileNav 内嵌于 TopBar）
 * + 顶栏（AdminTopBar）+ 内容区（Outlet）。全部语义色 token，随主题切换。
 * 子页面共用 PageShell 渲染标题与内容壳。
 */
function AdminLayout() {
	const title = useAdminTitle();

	// overflow-hidden：侧边栏切换走 FLIP——内容区宽度瞬时到位后以 translateX
	// 滑入，滑动期间视觉右缘短暂超出视口，需裁剪防止横向滚动条闪现。
	return (
		<div className="bg-background flex h-screen w-full overflow-hidden">
			<AdminSidebar />
			<div id="admin-content" className="flex min-w-0 flex-1 flex-col">
				<AdminTopBar title={title} />
				<main className="min-h-0 flex-1 overflow-hidden">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
