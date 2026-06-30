import { AdminSidebar } from "@features/admin-layout/ui/AdminSidebar";
import { AdminTopBar } from "@features/admin-layout/ui/AdminTopBar";
import { isSessionActive } from "@shared/api/session";
import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
    beforeLoad: async ({ context }) => {
        const { auth } = context;

        // 仅当「网络判定未登录」且「客户端确实没有活跃会话」时才踢人。
        // 后者（isSessionActive）不受网络瞬态失败影响——登录成功置 true、登出/取消
        // 重登才置 false。这样 token 过期导致 getCurrentUser 返回 null（auth.isAuthenticated
        // 短暂为 false）时，已登录用户不会被误踢回首页，而是原地等 refresh/弹窗恢复。
        if ((!auth.isAuthenticated || !auth.user) && !isSessionActive()) {
            throw redirect({
                to: "/",
                replace: true,
            });
        }

        // 检查用户是否有 admin:access 权限
        const hasAdminPermission = auth.user?.permissions?.includes("admin:access");

        // 检查用户是否是管理员角色（admin 或 superadmin）
        const isAdminRole = auth.user?.role === "admin" || auth.user?.role === "superadmin";

        // 必须同时满足：有 admin:access 权限 或 是管理员角色
        // sessionActive 但 auth.user 暂缺（瞬态）时放行，权限细化由子路由 PermissionGuard 兜
        if (auth.user && !hasAdminPermission && !isAdminRole) {
            throw redirect({
                to: "/",
                replace: true,
            });
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
    if (pathname.startsWith("/admin/posts")) return "文章管理";
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

    return (
        <div className="bg-background flex h-screen w-full">
            <AdminSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <AdminTopBar title={title} />
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
