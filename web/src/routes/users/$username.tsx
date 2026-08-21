import type { Tweet } from "@entities/tweet/model/types";
import { getDisplayName } from "@entities/user/model/display-name";
import { useMe } from "@features/auth/api/queries";
import { useCreateChatConversation } from "@features/chat/api/queries";
import { tweetKeys } from "@features/tweets/api/keys";
import {
	fetchUserProfile,
	fetchUserTimeline,
	useUserProfile,
	useUserTimeline,
} from "@features/tweets/api/queries";
import TweetCard from "@features/tweets/ui/TweetCard";
import type { PagedResponse } from "@shared/api/types";
import { avatarUrl } from "@shared/lib/image-url";
import { cn } from "@shared/lib/utils";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { PageShell } from "@shared/ui/page-shell";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { differenceInDays, format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
	Calendar,
	Check,
	Clock,
	Copy,
	Feather,
	Image as ImageIcon,
	Layers,
	Loader2,
	MessageCircle,
	MessageSquare,
	MoveRight,
	PenSquare,
	Share2,
	Sparkles,
	UserCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * 根据用户名计算个性化色彩梯度与环境主题。
 */
function getProfileTheme(username: string) {
	const themes = [
		{
			coverGradient: "from-violet-600/35 via-indigo-500/25 to-cyan-500/30",
			accentColor: "text-neon-cyan",
			glowBg: "bg-neon-cyan/20",
			badgeStyle: "border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan",
			pillStyle: "text-neon-cyan border-neon-cyan/25",
			highlightBg: "bg-neon-cyan/5",
		},
		{
			coverGradient: "from-fuchsia-600/35 via-purple-500/25 to-pink-500/30",
			accentColor: "text-neon-pink",
			glowBg: "bg-neon-pink/20",
			badgeStyle: "border-neon-pink/30 bg-neon-pink/10 text-neon-pink",
			pillStyle: "text-neon-pink border-neon-pink/25",
			highlightBg: "bg-neon-pink/5",
		},
		{
			coverGradient: "from-blue-600/35 via-sky-500/25 to-teal-500/30",
			accentColor: "text-neon-blue",
			glowBg: "bg-neon-blue/20",
			badgeStyle: "border-neon-blue/30 bg-neon-blue/10 text-neon-blue",
			pillStyle: "text-neon-blue border-neon-blue/25",
			highlightBg: "bg-neon-blue/5",
		},
		{
			coverGradient: "from-emerald-600/35 via-teal-500/25 to-cyan-500/30",
			accentColor: "text-neon-green",
			glowBg: "bg-neon-green/20",
			badgeStyle: "border-neon-green/30 bg-neon-green/10 text-neon-green",
			pillStyle: "text-neon-green border-neon-green/25",
			highlightBg: "bg-neon-green/5",
		},
		{
			coverGradient: "from-purple-600/35 via-violet-500/25 to-blue-500/30",
			accentColor: "text-neon-purple",
			glowBg: "bg-neon-purple/20",
			badgeStyle: "border-neon-purple/30 bg-neon-purple/10 text-neon-purple",
			pillStyle: "text-neon-purple border-neon-purple/25",
			highlightBg: "bg-neon-purple/5",
		},
	];

	let hash = 0;
	for (let i = 0; i < username.length; i++) {
		hash = (hash << 5) - hash + username.charCodeAt(i);
		hash |= 0;
	}
	const index = Math.abs(hash) % themes.length;
	const selectedTheme = themes[index];
	if (selectedTheme) return selectedTheme;
	return {
		coverGradient: "from-violet-600/35 via-indigo-500/25 to-cyan-500/30",
		accentColor: "text-neon-cyan",
		glowBg: "bg-neon-cyan/20",
		badgeStyle: "border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan",
		pillStyle: "text-neon-cyan border-neon-cyan/25",
		highlightBg: "bg-neon-cyan/5",
	};
}

/**
 * 格式化入驻天数展示文案。
 */
function getDaysJoined(createdAt?: string): string {
	if (!createdAt) return "1 天";
	const days = differenceInDays(new Date(), new Date(createdAt));
	if (days <= 0) return "今日加入";
	if (days < 30) return `${days} 天`;
	if (days < 365) return `${Math.floor(days / 30)} 个月`;
	const years = (days / 365).toFixed(1).replace(/\.0$/, "");
	return `${years} 年`;
}

/**
 * /users/$username - 公开用户主页（公开）
 *
 * 展示用户公开资料卡（头像/显示名/用户名/简介/注册时间/推文数）
 * 及该用户的推文时间线（cursor 滚动加载）。
 */
function UserPublicProfilePage() {
	const { username } = Route.useParams();
	const initialProfile = Route.useLoaderData();
	const navigate = useNavigate();

	const { data: currentUser } = useMe();
	const createChat = useCreateChatConversation();

	const [isChatStarting, setIsChatStarting] = useState(false);
	const [hasCopiedHandle, setHasCopiedHandle] = useState(false);
	const [hasCopiedLink, setHasCopiedLink] = useState(false);
	const [feedTab, setFeedTab] = useState<"all" | "media">("all");

	const {
		data: profileData,
		isLoading: isProfileLoading,
		error: profileError,
	} = useUserProfile(username);

	const {
		data: timelineData,
		isLoading: isTimelineLoading,
		isError: isTimelineError,
		error: timelineError,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useUserTimeline(username);

	const profile = profileData ?? initialProfile;
	const theme = useMemo(() => getProfileTheme(username), [username]);

	// 复制 @handle
	const handleCopyHandle = async () => {
		if (!profile) return;
		try {
			await navigator.clipboard.writeText(`@${profile.username}`);
			setHasCopiedHandle(true);
			toast.success(`已复制用户名 @${profile.username}`);
			setTimeout(() => setHasCopiedHandle(false), 2000);
		} catch {
			toast.error("复制失败");
		}
	};

	// 复制主页链接
	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			setHasCopiedLink(true);
			toast.success("主页链接已复制到剪贴板");
			setTimeout(() => setHasCopiedLink(false), 2000);
		} catch {
			toast.error("复制链接失败");
		}
	};

	// 发起私聊
	const handleStartChat = async () => {
		if (!profile) return;
		if (!currentUser) {
			navigate({
				to: "/login",
				search: { redirect: window.location.href },
			});
			return;
		}

		setIsChatStarting(true);
		try {
			const conversation = await createChat.mutateAsync({
				kind: "direct",
				participant_ids: [profile.id],
			});
			navigate({
				to: "/chat",
				search: { c: conversation.id },
			});
		} catch {
			toast.error("无法发起私聊，请稍后重试");
		} finally {
			setIsChatStarting(false);
		}
	};

	if (isProfileLoading && !profile) {
		return (
			<PageShell>
				<div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
					<div className="overflow-hidden rounded-3xl border border-edge-hairline bg-card/60 p-6 backdrop-blur">
						<ShimmerSkeleton className="h-32 w-full rounded-2xl" />
						<div className="-mt-14 ml-4">
							<ShimmerSkeleton className="size-24 rounded-3xl" />
						</div>
						<div className="mt-6 space-y-3">
							<ShimmerSkeleton className="h-8 w-40 rounded-xl" />
							<ShimmerSkeleton className="h-4 w-28 rounded-lg" />
							<ShimmerSkeleton className="h-16 w-full rounded-xl" />
						</div>
						<div className="mt-6 grid grid-cols-2 gap-3">
							<ShimmerSkeleton className="h-20 rounded-2xl" />
							<ShimmerSkeleton className="h-20 rounded-2xl" />
						</div>
					</div>
					<div className="space-y-6">
						<div className="flex items-center justify-between">
							<ShimmerSkeleton className="h-8 w-36 rounded-xl" />
							<ShimmerSkeleton className="h-8 w-24 rounded-xl" />
						</div>
						<ShimmerSkeleton className="h-44 w-full rounded-3xl" />
						<ShimmerSkeleton className="h-44 w-full rounded-3xl" />
					</div>
				</div>
			</PageShell>
		);
	}

	if (profileError || !profile) {
		return (
			<PageShell>
				<div className="mx-auto my-16 max-w-md text-center">
					<div className="relative mx-auto flex size-24 items-center justify-center rounded-3xl border border-edge-hairline bg-card/50 shadow-2xl backdrop-blur">
						<div className="absolute inset-0 rounded-3xl bg-neon-purple/10 blur-xl" />
						<Sparkles className="relative size-10 text-neon-purple" />
					</div>
					<h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
						未找到用户
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						该用户不存在或已被注销，请检查用户名拼写是否正确。
					</p>
					<div className="mt-6 flex items-center justify-center gap-3">
						<Button variant="outline" asChild>
							<Link to="/tweets">返回推文广场</Link>
						</Button>
						<Button asChild>
							<Link to="/">返回主页</Link>
						</Button>
					</div>
				</div>
			</PageShell>
		);
	}

	const allTweets = timelineData?.pages.flatMap((page) => page.data) ?? [];
	const tweets =
		feedTab === "media" ? allTweets.filter((t) => t.images && t.images.length > 0) : allTweets;

	const displayName = getDisplayName(profile);
	const joinedDate = profile.created_at
		? format(new Date(profile.created_at), "yyyy年M月", { locale: zhCN })
		: "";
	const daysJoined = getDaysJoined(profile.created_at);
	const isSelf = currentUser?.id === profile.id;
	const tweetCount = hasNextPage ? `${allTweets.length}+` : String(allTweets.length);
	const mediaCount = allTweets.filter((t) => t.images && t.images.length > 0).length;

	return (
		<PageShell>
			{/* 沉浸式环境光晕背景 */}
			<div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
				<div
					aria-hidden="true"
					className={cn(
						"absolute top-20 -left-20 size-96 rounded-full blur-[140px] opacity-30 transition-all duration-1000",
						theme.glowBg,
					)}
				/>
				<div
					aria-hidden="true"
					className="absolute top-40 right-0 size-[30rem] rounded-full bg-neon-purple/15 blur-[160px] opacity-40"
				/>
			</div>

			<div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
				{/* 左侧：Bento 个人信息名片 */}
				<aside className="h-fit">
					<div className="group/card relative overflow-hidden rounded-3xl border border-edge-hairline/80 bg-card/60 shadow-xl shadow-primary/5 backdrop-blur-xl transition-all duration-300 hover:border-edge-hairline hover:shadow-2xl hover:shadow-primary/10">
						{/* 顶栏艺术 Cover Banner */}
						<div
							className={cn(
								"relative h-32 w-full overflow-hidden bg-gradient-to-br transition-all sm:h-36",
								theme.coverGradient,
							)}
						>
							{/* 背景科技网格纹理 */}
							<div
								aria-hidden="true"
								className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/15 via-transparent to-transparent opacity-70"
							/>
							<div
								aria-hidden="true"
								className="absolute inset-0 bg-repeat opacity-[0.08]"
								style={{
									backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
									backgroundSize: "16px 16px",
								}}
							/>

							{/* 右上角胶囊徽章 */}
							<div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-background/40 px-3 py-1 font-mono text-[10px] font-medium tracking-[0.2em] text-foreground/90 uppercase backdrop-blur-md">
								<Sparkles className={cn("size-3", theme.accentColor)} />
								<span>Profile</span>
							</div>
						</div>

						{/* 卡片主体内容 */}
						<div className="relative px-6 pb-6">
							{/* 悬浮头像 */}
							<div className="relative -mt-14 flex items-end justify-between">
								<div className="group/avatar relative">
									<div
										aria-hidden="true"
										className={cn(
											"absolute -inset-1 rounded-3xl blur-md opacity-40 transition group-hover/avatar:opacity-80",
											theme.glowBg,
										)}
									/>
									<img
										src={avatarUrl(profile.avatar_url, profile.username)}
										alt={`${displayName} 的头像`}
										className="relative size-24 rounded-3xl border-4 border-card bg-card object-cover shadow-2xl transition duration-300 group-hover/avatar:scale-[1.03]"
									/>
								</div>

								{/* 认证/身份标 */}
								<div className="mb-1 flex items-center gap-1.5">
									<Badge
										variant="outline"
										className={cn(
											"gap-1 font-mono text-[11px] font-normal",
											theme.badgeStyle,
										)}
									>
										<UserCheck className="size-3" />
										社区成员
									</Badge>
								</div>
							</div>

							{/* 名字与 Handle */}
							<div className="mt-4">
								<h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
									{displayName}
								</h1>
								<div className="mt-1 flex items-center gap-2">
									<span className="font-mono text-xs text-muted-foreground">
										@{profile.username}
									</span>
									<button
										type="button"
										onClick={handleCopyHandle}
										title="复制用户名"
										className="inline-flex size-5 items-center justify-center rounded-md text-muted-foreground/70 transition hover:bg-muted hover:text-foreground"
									>
										{hasCopiedHandle ? (
											<Check className="size-3 text-neon-green" />
										) : (
											<Copy className="size-3" />
										)}
									</button>
								</div>
							</div>

							{/* 个人简介 */}
							<div className="mt-4 rounded-2xl border border-edge-hairline/60 bg-muted/25 p-3.5 backdrop-blur-sm">
								<p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-muted-foreground">
									{profile.bio?.trim() || "这个人很神秘，还没有留下任何简介 ✨"}
								</p>
							</div>

							{/* 快捷操作动作条 */}
							<div className="mt-5 flex gap-2">
								{isSelf ? (
									<Button
										variant="outline"
										size="sm"
										className="flex-1 gap-1.5 rounded-xl border-edge-hairline hover:bg-accent"
										asChild
									>
										<Link to="/profile">
											<PenSquare className="size-3.5" />
											编辑资料
										</Link>
									</Button>
								) : (
									<Button
										size="sm"
										onClick={handleStartChat}
										disabled={isChatStarting}
										className={cn(
											"flex-1 gap-1.5 rounded-xl font-medium shadow-md transition-all",
											"bg-primary text-primary-foreground hover:opacity-95",
										)}
									>
										{isChatStarting ? (
											<Loader2 className="size-3.5 animate-spin" />
										) : (
											<MessageCircle className="size-3.5" />
										)}
										发起私聊
									</Button>
								)}

								<Button
									variant="outline"
									size="sm"
									onClick={handleCopyLink}
									title="分享与复制链接"
									className="rounded-xl border-edge-hairline px-3 hover:bg-accent"
								>
									{hasCopiedLink ? (
										<Check className="size-3.5 text-neon-green" />
									) : (
										<Share2 className="size-3.5 text-muted-foreground" />
									)}
								</Button>
							</div>

							{/* Bento 详细数据网格 */}
							<div className="mt-5 grid grid-cols-2 gap-2.5">
								{/* 推文卡 */}
								<div className="group/stat rounded-2xl border border-edge-hairline/70 bg-background/50 p-3.5 transition hover:border-edge-hairline hover:bg-background/80">
									<div className="flex items-center justify-between text-muted-foreground">
										<span className="font-mono text-[10px] font-medium tracking-[0.16em] uppercase">
											Tweets
										</span>
										<Feather className="size-3.5 opacity-60 transition group-hover/stat:opacity-100" />
									</div>
									<p className="mt-2 text-xl font-bold tracking-tight text-foreground">
										{tweetCount}
									</p>
									<p className="mt-0.5 text-[11px] text-muted-foreground">
										累计发文
									</p>
								</div>

								{/* 入驻天数卡 */}
								<div className="group/stat rounded-2xl border border-edge-hairline/70 bg-background/50 p-3.5 transition hover:border-edge-hairline hover:bg-background/80">
									<div className="flex items-center justify-between text-muted-foreground">
										<span className="font-mono text-[10px] font-medium tracking-[0.16em] uppercase">
											Tenure
										</span>
										<Clock className="size-3.5 opacity-60 transition group-hover/stat:opacity-100" />
									</div>
									<p className="mt-2 text-xl font-bold tracking-tight text-foreground">
										{daysJoined}
									</p>
									<p className="mt-0.5 text-[11px] text-muted-foreground">
										加入时长
									</p>
								</div>
							</div>

							{/* 加入日期横条 */}
							{joinedDate && (
								<div className="mt-4 flex items-center justify-between rounded-xl border border-edge-hairline/40 bg-muted/15 px-3.5 py-2.5 text-xs text-muted-foreground">
									<span className="flex items-center gap-2">
										<Calendar className={cn("size-3.5", theme.accentColor)} />
										<span>注册于 {joinedDate}</span>
									</span>
									<span className="font-mono text-[10px] opacity-70">
										#ID-{profile.id.slice(0, 6)}
									</span>
								</div>
							)}
						</div>
					</div>
				</aside>

				{/* 右侧：推文与动态流 */}
				<main className="min-w-0">
					{/* 动态 Header 与筛选 Tabs */}
					<header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-edge-hairline/60 pb-4">
						<div>
							<div className="flex items-center gap-2">
								<span
									className={cn(
										"font-mono text-[10px] font-semibold tracking-[0.24em] uppercase",
										theme.accentColor,
									)}
								>
									Timeline & Activity
								</span>
								<div className="size-1.5 rounded-full bg-neon-green animate-pulse" />
							</div>
							<h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
								推文动态
							</h2>
						</div>

						{/* 视图 Tab 切换 */}
						<div className="flex items-center gap-1 rounded-xl border border-edge-hairline/70 bg-card/60 p-1 backdrop-blur-sm">
							<button
								type="button"
								onClick={() => setFeedTab("all")}
								className={cn(
									"flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition",
									feedTab === "all"
										? "bg-primary text-primary-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<Layers className="size-3.5" />
								全部 ({allTweets.length})
							</button>

							<button
								type="button"
								onClick={() => setFeedTab("media")}
								className={cn(
									"flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition",
									feedTab === "media"
										? "bg-primary text-primary-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<ImageIcon className="size-3.5" />
								图文 ({mediaCount})
							</button>
						</div>
					</header>

					{/* 动态内容区 */}
					{isTimelineLoading ? (
						<div className="space-y-4">
							{Array.from({ length: 3 }).map((_, index) => (
								<ShimmerSkeleton key={index} className="h-44 w-full rounded-3xl" />
							))}
						</div>
					) : isTimelineError ? (
						<div className="rounded-3xl border border-edge-hairline/80 bg-card/50 p-12 text-center backdrop-blur">
							<div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
								<MessageSquare className="size-6" />
							</div>
							<h3 className="mt-4 text-base font-semibold text-foreground">
								加载动态失败
							</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								{timelineError instanceof Error
									? timelineError.message
									: "获取推文时间线时发生未知错误"}
							</p>
						</div>
					) : tweets.length === 0 ? (
						/* 现代化科技感空状态 */
						<div className="relative overflow-hidden rounded-3xl border border-edge-hairline/80 bg-card/40 p-12 text-center backdrop-blur-xl">
							<div
								aria-hidden="true"
								className={cn(
									"pointer-events-none absolute top-1/2 left-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-20",
									theme.glowBg,
								)}
							/>

							<div className="relative">
								<div className="relative mx-auto flex size-16 items-center justify-center rounded-2xl border border-edge-hairline bg-background/80 shadow-inner">
									<Feather className={cn("size-7", theme.accentColor)} />
									<Sparkles className="absolute -top-1.5 -right-1.5 size-4 text-neon-purple animate-bounce" />
								</div>

								<h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">
									{feedTab === "media" ? "暂无图文推文" : "静候发声"}
								</h3>
								<p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
									{feedTab === "media"
										? "该用户目前还没有发布包含图片的推文。"
										: "该用户尚未发布任何推文。保持关注，静待最新发声。"}
								</p>

								{isSelf && feedTab === "all" ? (
									<div className="mt-6 flex justify-center">
										<Button asChild className="gap-2 rounded-xl shadow-md">
											<Link to="/tweets">
												发布第一条推文
												<MoveRight className="size-4" />
											</Link>
										</Button>
									</div>
								) : null}
							</div>
						</div>
					) : (
						/* 推文列表流 */
						<div className="space-y-4">
							<div className="flex flex-col gap-4">
								{tweets.map((tweet) => (
									<TweetCard key={tweet.id} tweet={tweet} />
								))}
							</div>

							{hasNextPage && (
								<div className="flex justify-center pt-6 pb-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => fetchNextPage()}
										disabled={isFetchingNextPage}
										className="gap-2 rounded-xl border-edge-hairline bg-card/80 px-6 backdrop-blur hover:bg-accent"
									>
										{isFetchingNextPage ? (
											<>
												<Loader2 className="size-3.5 animate-spin" />
												加载中…
											</>
										) : (
											"加载更多动态"
										)}
									</Button>
								</div>
							)}
						</div>
					)}
				</main>
			</div>
		</PageShell>
	);
}

export const Route = createFileRoute("/users/$username")({
	loader: async ({ context, params }) => {
		try {
			// 并行预取资料卡与首页推文
			const [profile] = await Promise.all([
				context.queryClient.ensureQueryData({
					queryKey: tweetKeys.userProfile(params.username),
					queryFn: () => fetchUserProfile(params.username),
				}),
				context.queryClient
					.ensureInfiniteQueryData({
						queryKey: tweetKeys.userTimelineOf(params.username),
						queryFn: ({ pageParam }) =>
							fetchUserTimeline(params.username, { cursor: pageParam }),
						initialPageParam: undefined as string | undefined,
						getNextPageParam: (lastPage: PagedResponse<Tweet>) =>
							lastPage.pagination?.next_cursor || undefined,
					})
					.catch(() => {}),
			]);
			if (!profile) throw notFound();
			return profile;
		} catch {
			throw notFound();
		}
	},
	head: ({ loaderData, params }) => {
		const profile = loaderData;
		const name = profile?.username ?? params.username;
		return {
			meta: [
				{ title: `${name} 的个人推文主页` },
				{ name: "description", content: profile?.bio || `${name} 的全站个人推文主页` },
			],
		};
	},
	component: UserPublicProfilePage,
});
