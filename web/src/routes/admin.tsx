import { requireAdmin } from "@features/admin-layout/ui/AdminGuard";
import { AdminLayout } from "@features/admin-layout/ui/AdminLayout";
import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * /admin - 后台管理布局路由
 *
 * 所有 /admin/* 子路由共享 AdminLayout。
 * beforeLoad 校验管理员身份，未登录或非管理员重定向到 /login。
 */
export const Route = createFileRoute("/admin")({
	beforeLoad: ({ context, location }) => {
		requireAdmin(context.auth.user, location.href);
	},
	component: AdminRouteComponent,
});

function AdminRouteComponent() {
	return (
		<AdminLayout>
			<Outlet />
		</AdminLayout>
	);
}
