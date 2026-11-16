import { getDisplayName } from "@entities/user/model/display-name";
import type { UserDTO } from "@entities/user/model/types";
import { AppearanceToggle } from "@features/appearance";
import { useLogout } from "@features/auth/api/mutations";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useChatUnreadCount } from "@features/chat/api/queries";
import { useChatUnreadTitle } from "@features/chat/hooks/use-chat-unread-title";
import { useChatStream } from "@features/chat/hooks/useChatStream";
import type { NotificationPanelData } from "@features/notifications/hooks/use-notification-panel";
import { ThemePanel, useThemeSwitcher } from "@features/theme-switcher";
import { CustomThemeDialog } from "@features/theme-switcher/ui/CustomThemeDialog";
import { ApiError } from "@shared/api/error";
import { avatarUrl } from "@shared/lib/image-url";
import { THEME_PRESETS } from "@shared/lib/theme-presets";
import { SeasonGlyph } from "@shared/ui/icons";
import { MessagePanel, type MessageTab } from "@shared/ui/message-panel";
import { NAVBAR_PILL_CLASS } from "@shared/ui/site-navbar";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
	BadgeAnchor,
	Count,
	iconProps,
	List,
	ListItem,
	ListItemContent,
	ListItemIcon,
	ListItemTitle,
	MorphingPopover,
	MorphingPopoverAnchor,
	MorphingPopoverContent,
	MorphingPopoverTrigger,
	Separator,
} from "@violet/ui";
import { cn } from "cn";
import { Bell, BellRing, CircleCheck, LayoutDashboard, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import HeaderMessages from "./HeaderMessages";

const ICON_BUTTON =
	"flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** 公共页头操作入口所用的登录用户资料。 */
export interface HeaderActionsProps {
	/** 省略或为 null 时呈现游客入口，不展示消息与账号卡片。 */
	user?: UserDTO | null;
}

/**
 * 公共页头的外观、消息与账号入口。
 *
 * @remarks
 * 主动登录跳转到 /login；LoginDialog 只接收受保护请求的 401。
 */
const HeaderActions = ({ user }: HeaderActionsProps) => {
	const logout = useLogout();
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const [panel, setPanel] = useState<"appearance" | "messages" | "account">("appearance");
	const [open, setOpen] = useState(false);
	const [customOpen, setCustomOpen] = useState(false);
	const [messageTab, setMessageTab] = useState<MessageTab>("notice");
	const { preset, custom } = useThemeSwitcher();
	const { data: chatUnread } = useChatUnreadCount(Boolean(user));
	const unreadChatCount = chatUnread?.unread_count ?? 0;
	useChatUnreadTitle(user ? unreadChatCount : 0);
	useChatStream();
	useEffect(() => {
		if (user) return;
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
		setOpen(false);
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

	const renderActions = (messages?: NotificationPanelData) => {
		const unread = messages?.unread ?? 0;
		const BellIcon = unread > 0 ? BellRing : Bell;
		const bell = (
			<BadgeAnchor badge={<Count value={unread} />}>
				<span className="flex size-8 items-center justify-center">
					<BellIcon {...iconProps(18)} />
				</span>
			</BadgeAnchor>
		);
		return (
			<>
				<MorphingPopover
					open={open}
					onOpenChange={(next) => {
						if (!customOpen) setOpen(next);
					}}
				>
					<MorphingPopoverAnchor asChild>
						<div className={cn(NAVBAR_PILL_CLASS, "gap-1 p-1")}>
							<MorphingPopoverTrigger
								aria-label={`季节与外观：${custom ? "自定义" : THEME_PRESETS[preset].name}`}
								className={cn(ICON_BUTTON, "text-decoration")}
								onClick={() => setPanel("appearance")}
							>
								<SeasonGlyph season={preset} size={18} />
							</MorphingPopoverTrigger>
							<Separator
								orientation="vertical"
								className="mx-0.5 h-4 self-center bg-rule2"
							/>
							{messages && (
								<MorphingPopoverTrigger
									aria-label={unread > 0 ? `消息，${unread} 条未读` : "消息"}
									className={cn(
										ICON_BUTTON,
										"text-muted-foreground hover:text-foreground",
										unread > 0 && "mr-5",
									)}
									onClick={() => setPanel("messages")}
								>
									{bell}
								</MorphingPopoverTrigger>
							)}
							{user ? (
								<MorphingPopoverTrigger
									aria-label="用户菜单"
									className={ICON_BUTTON}
									onClick={() => setPanel("account")}
								>
									<img
										src={avatarUrl(user.avatar_url, user.username)}
										alt=""
										className="size-8 rounded-full object-cover"
									/>
								</MorphingPopoverTrigger>
							) : (
								<Link
									to="/login"
									aria-label="登录"
									className={cn(
										ICON_BUTTON,
										"text-muted-foreground hover:text-foreground",
									)}
								>
									<User {...iconProps(18)} />
								</Link>
							)}
						</div>
					</MorphingPopoverAnchor>
					<MorphingPopoverContent
						key={panel}
						aria-label={
							panel === "appearance"
								? "季节与外观"
								: panel === "messages"
									? "消息"
									: "用户菜单"
						}
						className={cn(
							"p-0",
							panel === "messages"
								? "w-95"
								: panel === "appearance"
									? "w-84"
									: "w-72",
						)}
						ghost={
							<div className="flex h-full items-center gap-1 p-1">
								<span className="flex size-8 items-center justify-center text-decoration">
									<SeasonGlyph season={preset} size={18} />
								</span>
								<span className="mx-0.5 h-4 w-px bg-rule2" />
								{messages && (
									<span
										className={cn(
											"text-muted-foreground",
											unread > 0 && "mr-5",
										)}
									>
										{bell}
									</span>
								)}
								{user ? (
									<img
										src={avatarUrl(user.avatar_url, user.username)}
										alt=""
										className="size-8 rounded-full object-cover"
									/>
								) : (
									<span className="flex size-8 items-center justify-center">
										<User {...iconProps(18)} />
									</span>
								)}
							</div>
						}
						ghostClassName="pointer-events-none"
					>
						<div className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain">
							{panel === "appearance" && (
								<ThemePanel
									appearance={<AppearanceToggle size="sm" showLabels />}
									onCustomize={() => setCustomOpen(true)}
								/>
							)}
							{panel === "messages" && messages && (
								<div className="p-2">
									<MessagePanel
										{...messages}
										tab={messageTab}
										onTabChange={setMessageTab}
									/>
								</div>
							)}
							{panel === "account" && user && (
								<>
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
														<CircleCheck
															{...iconProps(
																12,
																"shrink-0 text-success",
															)}
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
									<List aria-label="账号导航" density="compact" className="p-1.5">
										<ListItem asChild>
											<Link to="/profile" onClick={() => setOpen(false)}>
												<ListItemIcon>
													<User {...iconProps(14)} />
												</ListItemIcon>
												<ListItemContent>
													<ListItemTitle>个人中心</ListItemTitle>
												</ListItemContent>
											</Link>
										</ListItem>
										{isAdmin && (
											<ListItem asChild>
												<Link to="/admin" onClick={() => setOpen(false)}>
													<ListItemIcon>
														<LayoutDashboard {...iconProps(14)} />
													</ListItemIcon>
													<ListItemContent>
														<ListItemTitle>后台管理</ListItemTitle>
													</ListItemContent>
												</Link>
											</ListItem>
										)}
									</List>

									<Separator className="bg-border/40" />

									<List aria-label="账号操作" density="compact" className="p-1.5">
										<ListItem
											onClick={handleLogout}
											disabled={logout.isPending}
										>
											<ListItemIcon>
												<LogOut {...iconProps(14)} />
											</ListItemIcon>
											<ListItemContent>
												<ListItemTitle>
													{logout.isPending ? "登出中..." : "登出"}
												</ListItemTitle>
											</ListItemContent>
										</ListItem>
									</List>
								</>
							)}
						</div>
					</MorphingPopoverContent>
				</MorphingPopover>
				<CustomThemeDialog open={customOpen} onOpenChange={setCustomOpen} />
			</>
		);
	};
	return user ? (
		<HeaderMessages user={user} onNavigate={() => setOpen(false)}>
			{renderActions}
		</HeaderMessages>
	) : (
		renderActions()
	);
};

export default HeaderActions;
