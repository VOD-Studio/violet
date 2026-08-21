import type { Tweet } from "@entities/tweet/model/types";
import { getDisplayName } from "@entities/user/model/display-name";
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
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { PageShell } from "@shared/ui/page-shell";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarDays, Loader2, Sparkles } from "lucide-react";

/**
 * /users/$username - 公开用户主页（公开）
 *
 * 展示用户公开资料卡（头像/显示名/用户名/简介/注册时间/推文数）
 * 及该用户的推文时间线（cursor 滚动加载）。不暴露邮箱等私域字段。
 */
function UserPublicProfilePage() {
	const { username } = Route.useParams();
	const initialProfile = Route.useLoaderData();

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

	if (isProfileLoading && !profile) {
		return (
			<PageShell>
				<div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
					<ShimmerSkeleton className="h-96 w-full rounded-3xl" />
					<div className="space-y-4">
						<ShimmerSkeleton className="h-20 w-48 rounded-xl" />
						<ShimmerSkeleton className="h-40 w-full rounded-2xl" />
						<ShimmerSkeleton className="h-40 w-full rounded-2xl" />
					</div>
				</div>
			</PageShell>
		);
	}

	if (profileError || !profile) {
		return (
			<PageShell>
				<Empty
					title="用户不存在"
					description="未找到该用户的主页，请检查用户名是否正确。"
					className="py-20"
				/>
			</PageShell>
		);
	}

	const tweets = timelineData?.pages.flatMap((page) => page.data) ?? [];
	const displayName = getDisplayName(profile);
	const joinedDate = profile.created_at
		? format(new Date(profile.created_at), "yyyy年M月", { locale: zhCN })
		: "";
	const tweetCount = hasNextPage ? `${tweets.length}+` : String(tweets.length);

	return (
		<PageShell>
			<div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
				<aside className="relative overflow-hidden rounded-3xl border border-edge-hairline bg-card/85 p-5 shadow-lg shadow-primary/5 backdrop-blur">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-neon-cyan/15 blur-3xl"
					/>
					<div
						aria-hidden="true"
						className="pointer-events-none absolute -bottom-20 -left-16 size-44 rounded-full bg-neon-purple/10 blur-3xl"
					/>

					<div className="relative">
						<div className="flex items-center justify-between gap-3">
							<span className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-neon-cyan">
								Public profile
							</span>
							<Sparkles className="size-4 text-neon-purple" />
						</div>

						<img
							src={avatarUrl(profile.avatar_url, profile.username)}
							alt={`${displayName} 的头像`}
							className="mt-6 size-24 rounded-3xl border-2 border-background object-cover shadow-xl ring-1 ring-primary/20"
						/>

						<h1 className="mt-5 truncate text-2xl font-bold tracking-tight text-foreground">
							{displayName}
						</h1>
						<p className="mt-1 truncate font-mono text-xs text-muted-foreground">
							@{profile.username}
						</p>

						<p className="mt-5 min-h-12 whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-muted-foreground">
							{profile.bio || "这个用户还没有写简介。"}
						</p>

						{joinedDate && (
							<div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
								<CalendarDays className="size-3.5 text-neon-cyan" />
								<span>{joinedDate} 加入</span>
							</div>
						)}

						<div className="mt-6 grid grid-cols-2 gap-2">
							<div className="rounded-2xl border border-edge-hairline/70 bg-background/45 p-3">
								<p className="text-xl font-semibold text-foreground">{tweetCount}</p>
								<p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
									Tweets
								</p>
							</div>
							<div className="rounded-2xl border border-edge-hairline/70 bg-background/45 p-3">
								<p className="text-xl font-semibold text-foreground">
									{joinedDate || "—"}
								</p>
								<p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
									Joined
								</p>
							</div>
						</div>
					</div>
				</aside>

				<main className="min-w-0">
					<header className="mb-5 flex items-end justify-between gap-4 px-1">
						<div>
							<p className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-neon-cyan">
								Activity
							</p>
							<h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
								推文
							</h2>
						</div>
						<span className="rounded-full border border-edge-hairline bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
							{tweetCount} 条
						</span>
					</header>

					{isTimelineLoading ? (
						<div className="space-y-4">
							{Array.from({ length: 3 }).map((_, index) => (
								<ShimmerSkeleton key={index} className="h-40 w-full rounded-2xl" />
							))}
						</div>
					) : isTimelineError ? (
						<Empty
							title="加载失败"
							description={
								timelineError instanceof Error ? timelineError.message : "未知错误"
							}
							className="rounded-3xl border border-edge-hairline bg-card/60 py-16"
						/>
					) : tweets.length === 0 ? (
						<Empty
							title="暂无推文"
							description="该用户尚未发布任何推文。"
							className="rounded-3xl border border-edge-hairline bg-card/60 py-16"
						/>
					) : (
						<>
							<div className="flex flex-col gap-4">
								{tweets.map((tweet) => (
									<TweetCard key={tweet.id} tweet={tweet} />
								))}
							</div>
							{hasNextPage && (
								<div className="flex justify-center py-5">
									<Button
										variant="outline"
										size="sm"
										onClick={() => fetchNextPage()}
										disabled={isFetchingNextPage}
									>
										{isFetchingNextPage ? (
											<>
												<Loader2 className="size-3.5 animate-spin" />
												加载中…
											</>
										) : (
											"加载更多"
										)}
									</Button>
								</div>
							)}
						</>
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
				{ title: `${name} 的推文主页` },
				{ name: "description", content: profile?.bio || `${name} 的全站个人推文主页` },
			],
		};
	},
	component: UserPublicProfilePage,
});
