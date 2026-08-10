import type { UserDTO } from "@entities/user/model/types";
import { useLogout } from "@features/auth/api/mutations";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { ApiError } from "@shared/api/error";
import { avatarUrl } from "@shared/lib/image-url";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@shared/ui/base/dropdown-menu";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCommandUIStore } from "@widgets/CommandPalette/command-ui-store";
import ThemeToggle from "@widgets/ThemeToggle";
import { CheckCircle2, ChevronDown, LayoutDashboard, LogOut, Search, User } from "lucide-react";

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
 * - 已登录：圆形头像 trigger 触发下拉菜单——
 *   顶部用户信息卡（头像/用户名/邮箱/角色）+ 分组菜单（账户 / 后台 / 登出）
 *
 * 注意：LoginDialog 是**被动**的——仅在受保护请求收到 401 时由 http 拦截器自动
 * 弹出。主动登录走 /login 页面（完整表单 + redirect 回跳）。
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

	const isAdmin = useHasPermission("admin:access");

	return (
		<div className="flex items-center gap-2">
			<Button variant="ghost" size="icon-sm" aria-label="搜索" onClick={openCommand}>
				<Search className="size-4" />
			</Button>
			<ThemeToggle />

			{/* 用户槽位：固定宽度，避免登录/登出触发 Header 跳动 */}
			<div className="flex w-[136px] justify-end">
				{user ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								aria-label="用户菜单"
								className={cn(
									"group relative flex items-center gap-1.5 rounded-full border border-transparent p-0.5 pr-2.5",
									"transition-all duration-200 hover:border-border/60 hover:bg-accent/40",
									"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-1",
									"data-[state=open]:border-border/80 data-[state=open]:bg-accent/50",
								)}
							>
								<img
									src={avatarUrl(user.avatar_url, user.username)}
									alt={user.username}
									className="size-7 rounded-full object-cover ring-1 ring-border/40"
								/>
								<span className="hidden text-sm font-medium md:inline-block md:max-w-24 md:truncate">
									{user.username}
								</span>
								<ChevronDown
									className={cn(
										"size-3.5 text-muted-foreground transition-transform duration-200",
										"group-data-[state=open]:rotate-180",
									)}
								/>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							sideOffset={10}
							className="w-72 overflow-hidden rounded-xl border-border/40 p-0 shadow-xl shadow-black/5 backdrop-blur-xl dark:shadow-black/40"
						>
							{/* 用户信息卡：头像 + 邮箱 + 角色徽章 */}
							<div className="relative border-b border-border/40 bg-gradient-to-br from-accent/40 via-transparent to-transparent px-4 pb-4 pt-4">
								<div className="flex items-start gap-3">
									<img
										src={avatarUrl(user.avatar_url, user.username)}
										alt={user.username}
										className="size-12 shrink-0 rounded-full object-cover ring-1 ring-border/50"
									/>
									<div className="min-w-0 flex-1">
										<p className="truncate font-mono text-sm font-semibold tracking-tight text-foreground">
											{user.username}
										</p>
										<p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
											<span className="truncate">{user.email}</span>
											{/* root 用户必有邮箱，无需重复显示；仅普通用户显示验证勾 */}
											{!user.is_root && user.email_verified && (
												<CheckCircle2
													className="size-3 shrink-0 text-emerald-500"
													aria-label="邮箱已验证"
												/>
											)}
										</p>
										<div className="mt-2 flex items-center gap-1.5">
											{user.is_root ? (
												<span className="inline-flex items-center rounded-full bg-foreground px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide text-background uppercase">
													root
												</span>
											) : (
												<span className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-medium tracking-wide text-foreground/80 uppercase backdrop-blur-sm">
													{user.role_description || user.role}
												</span>
											)}
										</div>
									</div>
								</div>
							</div>
							{/* 菜单分组 */}
							<div className="p-1.5">
								<DropdownMenuItem asChild>
									<Link
										to="/profile"
										className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2"
									>
										<span className="flex size-7 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
											<User className="size-3.5" />
										</span>
										<span className="flex-1 text-sm">个人中心</span>
									</Link>
								</DropdownMenuItem>
								{isAdmin && (
									<DropdownMenuItem asChild>
										<Link
											to="/admin"
											className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2"
										>
											<span className="flex size-7 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
												<LayoutDashboard className="size-3.5" />
											</span>
											<span className="flex-1 text-sm">后台管理</span>
										</Link>
									</DropdownMenuItem>
								)}
							</div>

							<DropdownMenuSeparator className="mx-3 bg-border/40" />

							<div className="p-1.5">
								<DropdownMenuItem
									onClick={handleLogout}
									disabled={logout.isPending}
									className="cursor-pointer rounded-md px-2.5 py-2"
								>
									<span className="flex size-7 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
										<LogOut className="size-3.5" />
									</span>
									<span className="flex-1 text-sm">
										{logout.isPending ? "登出中..." : "登出"}
									</span>
								</DropdownMenuItem>
							</div>
						</DropdownMenuContent>
					</DropdownMenu>
				) : (
					<Button variant="ghost" size="sm" asChild>
						<Link to="/login">登录</Link>
					</Button>
				)}
			</div>
		</div>
	);
};

export default HeaderActions;
