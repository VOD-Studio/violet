import type { Tweet } from "@entities/tweet/model/types";
import { userKeys } from "@entities/user/api/keys";
import { useMe } from "@features/auth/api/queries";
import { tweetKeys } from "@features/tweets/api/keys";
import {
	fetchUserProfile,
	fetchUserTimeline,
	useUserProfile,
	useUserTimeline,
} from "@features/tweets/api/queries";
import { buildActivityGrid, summarizeActivity } from "@features/tweets/model/profile-activity";
import { UserProfileCover } from "@features/tweets/ui/profile/UserProfileCover";
import { UserProfileFeed } from "@features/tweets/ui/profile/UserProfileFeed";
import { UserProfileLayout } from "@features/tweets/ui/profile/UserProfileLayout";
import { UserProfilePanel } from "@features/tweets/ui/profile/UserProfilePanel";
import { UserProfileRail } from "@features/tweets/ui/profile/UserProfileRail";
import type { PagedResponse } from "@shared/api/types";
import { avatarUrl } from "@shared/lib/image-url";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button, PageShell, ShimmerSkeleton } from "@violet/ui";
import { useMemo } from "react";

/**
 * /users/$username - 公开用户主页（公开）
 *
 * 封面加三栏：资料栏、推文内容、动态概览；推文按 cursor 滚动加载。
 */
function UserPublicProfilePage() {
	const { username } = Route.useParams();
	const initialProfile = Route.useLoaderData();
	const { data: currentUser } = useMe();
	const {
		data: profileData,
		isLoading: isProfileLoading,
		error: profileError,
	} = useUserProfile(username);
	const timeline = useUserTimeline(username);

	const profile = profileData ?? initialProfile;
	const tweets: Tweet[] = useMemo(
		() => timeline.data?.pages.flatMap((page) => page.data) ?? [],
		[timeline.data],
	);
	const hasNextPage = Boolean(timeline.hasNextPage);
	const activity = useMemo(() => summarizeActivity(tweets, hasNextPage), [tweets, hasNextPage]);
	const grid = useMemo(() => buildActivityGrid(tweets), [tweets]);

	if (isProfileLoading && !profile) {
		return (
			<PageShell>
				<div className="mx-auto w-full max-w-7xl">
					<ShimmerSkeleton className="h-32 w-full rounded-2xl sm:h-40" />
					<div className="grid gap-8 px-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
						<div className="-mt-20 space-y-3">
							<ShimmerSkeleton className="size-28 rounded-full" />
							<ShimmerSkeleton className="h-8 w-40 rounded-lg" />
							<ShimmerSkeleton className="h-4 w-24 rounded-lg" />
							<ShimmerSkeleton className="h-16 w-full rounded-lg" />
						</div>
						<div className="flex flex-col gap-4 lg:pt-6">
							{Array.from({ length: 2 }).map((_, index) => (
								<ShimmerSkeleton key={index} className="h-48 w-full rounded-2xl" />
							))}
						</div>
					</div>
				</div>
			</PageShell>
		);
	}

	if (profileError || !profile) {
		return (
			<PageShell>
				<div
					role="status"
					className="mx-auto flex max-w-md flex-col items-center gap-2 py-24 text-center"
				>
					<h1 className="text-2xl font-bold tracking-tight">未找到用户</h1>
					<p className="text-sm text-muted-foreground">
						该用户不存在或已被注销，请检查用户名拼写是否正确。
					</p>
					<div className="mt-4 flex gap-3">
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

	const mediaCount = tweets.filter((tweet) => tweet.images && tweet.images.length > 0).length;
	const tweetCount = hasNextPage ? `${tweets.length}+` : String(tweets.length);
	const hasRail = activity.latestAt !== undefined || activity.topics.length > 0;

	return (
		<PageShell>
			<UserProfileLayout
				cover={
					<UserProfileCover
						avatarSrc={avatarUrl(profile.avatar_url, profile.username)}
						coverSrc={profile.cover_url}
					/>
				}
				panel={
					<UserProfilePanel
						profile={profile}
						tweetCount={tweetCount}
						mediaCount={mediaCount}
						likeCount={`${activity.likeCount}${hasNextPage ? "+" : ""}`}
					/>
				}
				main={
					<UserProfileFeed
						tweets={tweets}
						isLoading={timeline.isLoading}
						error={timeline.isError ? (timeline.error as Error) : null}
						hasNextPage={hasNextPage}
						isFetchingNextPage={timeline.isFetchingNextPage}
						onLoadMore={() => timeline.fetchNextPage()}
						isSelf={currentUser?.id === profile.id}
					/>
				}
				rail={hasRail ? <UserProfileRail activity={activity} grid={grid} /> : undefined}
			/>
		</PageShell>
	);
}

export const Route = createFileRoute("/users/$username")({
	loader: async ({ context, params }) => {
		try {
			// 并行预取资料卡与首页推文
			const [profile] = await Promise.all([
				context.queryClient.ensureQueryData({
					queryKey: userKeys.profile(params.username),
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
				{ title: `${name} 的个人主页` },
				{ name: "description", content: profile?.bio || `${name} 的个人主页` },
			],
		};
	},
	component: UserPublicProfilePage,
});
