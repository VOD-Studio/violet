import type { UserDTO } from "@entities/user/model/types";
import { useLogout } from "@features/auth/api/mutations";
import { ApiError } from "@shared/api/error";
import { Button } from "@shared/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCommandUIStore } from "@widgets/CommandPalette/command-ui-store";
import ThemeToggle from "@widgets/ThemeToggle";
import { ChevronDown, Command, LayoutDashboard, LogOut, User } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

interface HeaderActionsProps {
    user?: UserDTO | null;
}

/**
 * HeaderActions - 右侧操作区
 *
 * - 命令面板触发按钮（调 useCommandUIStore.open，与 Cmd+K 同源）
 * - ThemeToggle（机械轴体）
 * - 未登录：单个「登录」按钮（跳 /login，登录页内含注册/找回密码入口）
 *   + Cmd+L 快捷键直达登录页
 * - 已登录：用户名 Dropdown（个人中心 / 后台[仅 admin] / 登出）
 *
 * 注意：LoginDialog 是**被动**的——仅在 token 过期、refresh 失败时由 authGate 自动
 * 弹出（含挂起请求重放）。主动登录走 /login 页面（完整表单 + redirect 回跳）。
 */
const HeaderActions = ({ user }: HeaderActionsProps) => {
    const openCommand = useCommandUIStore((s) => s.open);
    const logout = useLogout();
    const navigate = useNavigate();
    const pathname = useRouterState({ select: (s) => s.location.pathname });

    // Cmd/Ctrl + L 直达登录页（仅未登录时生效，已登录无需鉴权）
    useEffect(() => {
        if (user) return; // 已登录不注册快捷键
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
                e.preventDefault();
                navigate({ to: "/login" }).catch(() => {});
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [user, navigate]);

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

    const isAdmin = user?.role === "admin" || user?.role === "superadmin";

    return (
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" aria-label="命令面板" onClick={openCommand}>
                <Command className="size-4" />
            </Button>
            <ThemeToggle />

            {user ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1">
                            <User className="size-4" />
                            <span className="max-w-28 truncate">{user.username}</span>
                            <ChevronDown className="size-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44">
                        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link to="/profile">
                                <User className="size-4" />
                                个人中心
                            </Link>
                        </DropdownMenuItem>
                        {isAdmin ? (
                            <DropdownMenuItem asChild>
                                <Link to="/admin">
                                    <LayoutDashboard className="size-4" />
                                    后台管理
                                </Link>
                            </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            onClick={handleLogout}
                            disabled={logout.isPending}
                        >
                            <LogOut className="size-4" />
                            登出
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <Button variant="ghost" size="sm" asChild>
                    <Link to="/login">登录</Link>
                </Button>
            )}
        </div>
    );
};

export default HeaderActions;
