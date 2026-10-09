import type { Tweet } from "@entities/tweet/model/types";
import { useMe } from "@features/auth/api/queries";
import { tweetKeys } from "@features/tweets/api/keys";
import {
	fetchUserProfile,
	fetchUserTimeline,
	useUserProfile,
	useUserTimeline,
} from "@features/tweets/api/queries";
import { UserProfileFeed } from "@features/tweets/ui/profile/UserProfileFeed";
import { UserProfileHeader } from "@features/tweets/ui/profile/UserProfileHeader";
import type { PagedResponse } from "@shared/api/types";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button, PageShell, ShimmerSkeleton } from "@violet/ui";

/** 与推文广场同宽的单列版心，让两页之间切换时阅读节奏一致。 */
function Column({ children }: { children: React.ReactNode }) {
	return <div className="mx-auto w-full max-w-3xl">{children}</div>;
}

/**
 * /users/$username - 公开用户主页（公开）
 *
 * 身份区加推文流的单列布局；推文按 cursor 滚动加载。
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

	if (isProfileLoading && !profile) {
		return (
			<PageShell>
				<Column>
					<div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:gap-6">
						<ShimmerSkeleton className="size-24 shrink-0 rounded-full" />
						<div className="flex-1 space-y-3">
							<ShimmerSkeleton className="h-8 w-48 rounded-lg" />
							<ShimmerSkeleton className="h-4 w-28 rounded-lg" />
							<ShimmerSkeleton className="h-12 w-full max-w-prose rounded-lg" />
						</div>
					</div>
					<div className="mt-8 flex flex-col gap-4">
						{Array.from({ length: 2 }).map((_, index) => (
							<ShimmerSkeleton key={index} className="h-48 w-full rounded-2xl" />
						))}
					</div>
				</Column>
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

	const tweets: Tweet[] = timeline.data?.pages.flatMap((page) => page.data) ?? [];
	const mediaCount = tweets.filter((tweet) => tweet.images && tweet.images.length > 0).length;
	const tweetCount = timeline.hasNextPage ? `${tweets.length}+` : String(tweets.length);

	return (
		<PageShell>
			<Column>
				<UserProfileHeader
					profile={profile}
					tweetCount={tweetCount}
					mediaCount={mediaCount}
				/>
				<UserProfileFeed
					tweets={tweets}
					isLoading={timeline.isLoading}
					error={timeline.isError ? (timeline.error as Error) : null}
					hasNextPage={Boolean(timeline.hasNextPage)}
					isFetchingNextPage={timeline.isFetchingNextPage}
					onLoadMore={() => timeline.fetchNextPage()}
					isSelf={currentUser?.id === profile.id}
				/>
			</Column>
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
