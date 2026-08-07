import { tweetKeys } from "@features/tweets/api/keys";
import {
	fetchUserProfile,
	fetchUserTimeline,
	useUserProfile,
	useUserTimeline,
} from "@features/tweets/api/queries";
import TweetCard from "@features/tweets/ui/TweetCard";
import { avatarUrl } from "@shared/lib/image-url";
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { PageShell } from "@shared/ui/page-shell";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Calendar, Loader2 } from "lucide-react";

/**
 * /users/$username - 公开用户主页（公开）
 *
 * 全站第一个公开用户页。展示用户公开资料卡（头像/用户名/简介/注册时间）
 * 及该用户的推文时间线（cursor 滚动加载）。
 * 用户不存在返回 404 兜底页。不暴露邮箱等私域字段。
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
				<div className="mx-auto w-full max-w-2xl space-y-6">
					<ShimmerSkeleton className="h-36 w-full rounded-2xl" />
					<ShimmerSkeleton className="h-40 w-full rounded-xl" />
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

	const tweets = timelineData?.pages.flatMap((p) => p.data) ?? [];

	const joinedDate = profile.created_at
		? format(new Date(profile.created_at), "yyyy年M月", { locale: zhCN })
		: "";

	return (
		<PageShell>
			<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
				{/* 用户公开资料卡 */}
				<header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
					<div className="flex items-start gap-4">
						<img
							src={avatarUrl(profile.avatar_url, profile.username)}
							alt={profile.username}
							className="size-16 shrink-0 rounded-full object-cover border border-border"
						/>
						<div className="min-w-0 flex-1">
							<h1 className="truncate font-mono text-2xl font-bold text-foreground">
								{profile.username}
							</h1>
							{profile.bio && (
								<p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
									{profile.bio}
								</p>
							)}
							{joinedDate && (
								<div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
									<Calendar className="size-3.5" />
									<span>{joinedDate} 加入</span>
								</div>
							)}
						</div>
					</div>
				</header>

				{/* 该用户的推文列表 */}
				<section className="flex flex-col gap-4">
					<h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
						Tweets ({tweets.length})
					</h2>

					{isTimelineLoading ? (
						<div className="space-y-4">
							{Array.from({ length: 2 }).map((_, i) => (
								<ShimmerSkeleton key={i} className="h-40 w-full rounded-xl" />
							))}
						</div>
					) : isTimelineError ? (
						<Empty
							title="加载失败"
							description={
								timelineError instanceof Error ? timelineError.message : "未知错误"
							}
							className="py-12"
						/>
					) : tweets.length === 0 ? (
						<Empty
							title="暂无推文"
							description="该用户尚未发布任何推文。"
							className="py-12"
						/>
					) : (
						<>
							<div className="flex flex-col gap-4">
								{tweets.map((tweet) => (
									<TweetCard key={tweet.id} tweet={tweet} />
								))}
							</div>
							{hasNextPage && (
								<div className="flex justify-center py-2">
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
				</section>
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
				context.queryClient.ensureQueryData({
					queryKey: tweetKeys.userTimelineOf(params.username),
					queryFn: () => fetchUserTimeline(params.username),
				}),
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
