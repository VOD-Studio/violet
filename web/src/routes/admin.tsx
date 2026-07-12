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

        // 仅当「网络判定未登录」且「客户端确实没有活跃会话」时才踢人。
        // 后者（isSessionActive）不受网络瞬态失败影响——登录成功置 true、登出才置 false。
        // 这样 session 过期导致 getAuthSession 返回 null（auth.isAuthenticated 短暂为 false）
        // 时，已登录用户不会被误踢，而是原地等弹窗重登。
        if ((!auth.isAuthenticated || !auth.claims) && !isSessionActive()) {
            throw redirect({
                to: "/",
                replace: true,
            });
        }

        // 检查用户是否有后台访问权限（admin:access）
        // claims 不含权限数组，经 queryClient 取 /auth/me（与 useMe 同缓存键，自动复用）。
        // 内置超管（is_builtin_super_admin）通配短路放行，不必查权限。
        if (auth.claims && !auth.claims.is_builtin_super_admin) {
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
            const hasAccess = me?.permissions?.includes("admin:access") ?? false;
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
