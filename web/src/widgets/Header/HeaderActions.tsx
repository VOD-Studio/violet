import type { UserDTO } from "@entities/user/model/types";
import { useLogout } from "@features/auth/api/mutations";
import { ApiError } from "@shared/api/error";
import { Button } from "@shared/ui/button";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCommandUIStore } from "@widgets/CommandPalette/command-ui-store";
import ThemeToggle from "@widgets/ThemeToggle";
import { Command, LogOut } from "lucide-react";
import { toast } from "sonner";

interface HeaderActionsProps {
    user?: UserDTO | null;
}

/**
 * HeaderActions - 右侧操作区
 *
 * - 命令面板触发按钮（调 useCommandUIStore.open，与 Cmd+K 同源）
 * - ThemeToggle（机械轴体）
 * - 管理员后台入口（仅 admin/superadmin）
 * - 登录入口（跳转 /login 页面）/ 个人中心 + 登出（已登录时）
 *
 * 注意：登录弹窗（LoginDialog）是**被动**的——仅在 token 过期、业务请求 refresh
 * 失败时由 authGate 自动弹出。主动登录走 /login 页面（完整表单 + redirect 回跳）。
 */
const HeaderActions = ({ user }: HeaderActionsProps) => {
    const openCommand = useCommandUIStore((s) => s.open);
    const logout = useLogout();
    const navigate = useNavigate();
    const pathname = useRouterState({ select: (s) => s.location.pathname });

    const handleLogout = () => {
        logout.mutate(undefined, {
            onSuccess: () => {
                toast.success("已登出");
                // 登出后离开受保护页：卸载 profile/admin 的 useMe 观察者，
                // 避免缓存陈旧后 refetch → 401 → 误弹登录窗。
                const onProtected =
                    pathname.startsWith("/profile") || pathname.startsWith("/admin");
                if (onProtected) {
                    navigate({ to: "/", replace: true }).catch(() => {});
                }
            },
            onError: (err) => {
                const msg =
                    err instanceof ApiError ? err.message : err.message || "登出失败，请稍后再试";
                toast.error(msg);
            },
        });
    };

    return (
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" aria-label="命令面板" onClick={openCommand}>
                <Command className="size-4" />
            </Button>
            <ThemeToggle />

            {user ? (
                <>
                    <Button variant="ghost" size="sm" asChild>
                        <Link to="/profile">个人中心</Link>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="登出"
                        onClick={handleLogout}
                        disabled={logout.isPending}
                    >
                        <LogOut className="size-4" />
                    </Button>
                </>
            ) : (
                <Button variant="ghost" size="sm" asChild>
                    <Link to="/login">登录</Link>
                </Button>
            )}
        </div>
    );
};

export default HeaderActions;
