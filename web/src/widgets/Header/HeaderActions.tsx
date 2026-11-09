import { getDisplayName } from "@entities/user/model/display-name";
import type { UserDTO } from "@entities/user/model/types";
import { AppearanceToggle } from "@features/appearance";
import { useLogout } from "@features/auth/api/mutations";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useChatUnreadCount } from "@features/chat/api/queries";
import { useChatUnreadTitle } from "@features/chat/hooks/use-chat-unread-title";
import { useChatStream } from "@features/chat/hooks/useChatStream";
import { ThemeMenu } from "@features/theme-switcher";
import { ApiError } from "@shared/api/error";
import { avatarUrl } from "@shared/lib/image-url";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Separator,
} from "@violet/ui";
import { cn } from "cn";
import { CheckCircle2, LayoutDashboard, LogOut, User } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import HeaderMessages from "./HeaderMessages";

/** 药丸里统一的 32px 圆形图标按钮：悬停与展开态用柔和底色，聚焦环由药丸内边距留出空间。 */
const ICON_BUTTON =
	"flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * HeaderActions - 右药丸的内容
 *
 * 药丸外壳（底、模糊、边、阴影）由顶栏外壳提供，这里只输出内容，全部常驻可见：
 * 季节与外观（花形按钮，面板含明暗切换与主题配色）、分隔线、
 * 消息铃铛（仅登录后，角标为通知与聊天未读之和）、账号。
 * 账号为 size-8 圆形：登录后是头像下拉菜单，未登录是人形图标，点击跳 /login。
 *
 * 注意：LoginDialog 是**被动**的——仅在受保护请求收到 401 时由 http 拦截器自动
 * 弹出。主动登录走 /login 页面（完整表单 + redirect 回跳）。
 */
const HeaderActions = ({ user }: { user?: UserDTO | null }) => {
	const logout = useLogout();
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const { data: chatUnread } = useChatUnreadCount(Boolean(user));
	const unreadChatCount = chatUnread?.unread_count ?? 0;
	useChatUnreadTitle(user ? unreadChatCount : 0);
	// 聊天事件流全局挂载：任意页面收到新消息，消息铃铛的未读角标即时刷新
	useChatStream();
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
		<div className="flex items-center gap-0.5">
			<ThemeMenu appearance={<AppearanceToggle size="default" />} />
			<Separator orientation="vertical" className="h-4 bg-rule2" />
			{user && <HeaderMessages user={user} />}
			{user ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							aria-label="用户菜单"
							className={cn(ICON_BUTTON, "data-[state=open]:bg-muted/70")}
						>
							<img
								src={avatarUrl(user.avatar_url, user.username)}
								alt=""
								className="size-8 rounded-full object-cover"
							/>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-72 max-w-72 p-0">
						{/* 用户信息卡：头像 + 邮箱 + 角色徽章 */}
						<div className="relative border-b border-border/40 bg-linear-to-br from-accent/40 via-transparent to-transparent px-4 pb-4 pt-4">
							<div className="flex items-start gap-3">
								<img
									src={avatarUrl(user.avatar_url, user.username)}
									alt={user.username}
									className="size-12 shrink-0 rounded-full object-cover ring-1 ring-border/50"
								/>
								<div className="min-w-0 flex-1">
									<p className="truncate font-mono text-sm font-semibold tracking-tight text-foreground">
										{getDisplayName(user)}
									</p>
									<p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
										<span className="truncate">{user.email}</span>
										{/* root 用户必有邮箱，无需重复显示；仅普通用户显示验证勾 */}
										{!user.is_root && user.email_verified && (
											<CheckCircle2
												className="size-3 shrink-0 text-success"
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
									className="flex items-center gap-2.5 rounded-md px-2.5 py-2"
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
										className="flex items-center gap-2.5 rounded-md px-2.5 py-2"
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
								className="rounded-md px-2.5 py-2"
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
				<Link
					to="/login"
					aria-label="登录"
					className={cn(ICON_BUTTON, "text-muted-foreground hover:text-foreground")}
				>
					<User className="size-4.25" />
				</Link>
			)}
		</div>
	);
};

export default HeaderActions;
