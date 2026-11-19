import { useMe } from "@features/auth/api/queries";
import { publicActivityOptions, publicProfileOptions } from "@features/profile/api/public-profile";
import {
	PROFILE_TABS,
	type ProfileTab,
	parseProfileSearch,
} from "@features/profile/model/public-profile";
import { ProfileCoverSection } from "@features/profile/ui/ProfileCoverSection";
import { PublicActivityFeed } from "@features/profile/ui/PublicActivityFeed";
import { PublicProfileSidebar } from "@features/profile/ui/PublicProfileSidebar";
import { ApiError } from "@shared/api/error";
import { avatarUrl } from "@shared/lib/image-url";
import { UserProfileCover } from "@shared/ui/profile-cover/UserProfileCover";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Empty,
	PageShell,
	Tabs,
	TabsContent,
	TabsCount,
	TabsList,
	TabsTrigger,
} from "@violet/ui";
import { ImagePlus } from "lucide-react";

const labels: Record<ProfileTab, string> = {
	all: "动态",
	posts: "文章",
	tweets: "推文",
	comments: "评论",
	annotations: "批注",
};

function UserPublicProfilePage() {
	const { username } = Route.useParams();
	const search = Route.useSearch();
	const tab = search.tab ?? "all";
	const initial = Route.useLoaderData();
	const navigate = Route.useNavigate();
	const { data: currentUser } = useMe();
	const profileQuery = useQuery(publicProfileOptions(username));
	const activityQuery = useQuery(publicActivityOptions(username, tab, search.cursor));
	const profile = profileQuery.data ?? initial.profile;
	const page = activityQuery.data ?? initial.page;
	if (profileQuery.isError) {
		return (
			<PageShell>
				<Empty
					title={
						profileQuery.error instanceof ApiError && profileQuery.error.status === 404
							? "未找到用户"
							: "主页加载失败"
					}
					description="请检查用户名或稍后重试。"
				/>
			</PageShell>
		);
	}
	const isSelf = currentUser?.id === profile.id;
	const next = page.pagination.next_cursor;
	return (
		<PageShell>
			<div className="mx-auto w-full max-w-280">
				<div className="relative">
					<UserProfileCover
						avatarSrc={avatarUrl(profile.avatar_url, profile.username)}
						coverSrc={profile.cover_url}
					/>
					{isSelf && currentUser && (
						<div className="absolute right-4 bottom-4">
							<Dialog>
								<DialogTrigger asChild>
									<Button variant="secondary" size="sm">
										<ImagePlus className="size-4" />
										更换横幅
									</Button>
								</DialogTrigger>
								<DialogContent size="lg">
									<DialogHeader>
										<DialogTitle>更换主页横幅</DialogTitle>
									</DialogHeader>
									<ProfileCoverSection user={currentUser} />
								</DialogContent>
							</Dialog>
						</div>
					)}
				</div>
				<div className="mt-6 grid items-start gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-10">
					<PublicProfileSidebar profile={profile} currentUser={currentUser} />
					<section className="min-w-0" aria-label="公开内容">
						<dl className="grid grid-cols-5 gap-2 sm:gap-6">
							{(["posts", "tweets", "comments", "annotations"] as const).map(
								(tab) => (
									<div key={tab}>
										<dt className="text-xs text-muted-foreground sm:text-sm">
											{labels[tab]}
										</dt>
										<dd className="mt-1 font-mono text-xl font-medium sm:text-2xl">
											<Link
												to="/users/$username"
												params={{ username }}
												search={{ tab }}
												resetScroll={false}
											>
												{profile.stats[tab]}
											</Link>
										</dd>
									</div>
								),
							)}
							<div>
								<dt className="text-xs text-muted-foreground sm:text-sm">获赞</dt>
								<dd className="mt-1 font-mono text-xl font-medium sm:text-2xl">
									{profile.stats.received_likes}
								</dd>
							</div>
						</dl>
						<p className="mt-4 text-xs leading-relaxed text-muted-foreground">
							统计当前公开内容。评论含文章和推文评论；获赞仅计推文收到的点赞，另收到{" "}
							{profile.stats.received_reactions} 次评论／批注表情回应。
						</p>
						<Tabs
							value={tab}
							className="mt-7"
							onValueChange={(value) =>
								navigate({
									search: { tab: value as ProfileTab },
									resetScroll: false,
								})
							}
						>
							<TabsList aria-label="内容分类">
								{PROFILE_TABS.map((tab) => (
									<TabsTrigger key={tab} value={tab}>
										{labels[tab]}
										{tab !== "all" && (
											<TabsCount>{profile.stats[tab]}</TabsCount>
										)}
									</TabsTrigger>
								))}
							</TabsList>
							{PROFILE_TABS.map((tab) => (
								<TabsContent key={tab} value={tab}>
									{activityQuery.isError ? (
										<div role="alert" className="py-8">
											<p>公开动态加载失败。</p>
											<Button
												variant="outline"
												onClick={() => activityQuery.refetch()}
											>
												重试
											</Button>
										</div>
									) : (
										<PublicActivityFeed items={page.data} />
									)}
								</TabsContent>
							))}
						</Tabs>
						<nav aria-label="动态翻页" className="mt-6 flex flex-wrap gap-3">
							{search.cursor && (
								<Button variant="outline" asChild>
									<Link
										to="/users/$username"
										params={{ username }}
										search={{ tab: search.tab }}
										resetScroll={false}
									>
										返回最新
									</Link>
								</Button>
							)}
							{next && (
								<Button variant="outline" asChild>
									<Link
										to="/users/$username"
										params={{ username }}
										search={{ tab: search.tab, cursor: next }}
										resetScroll={false}
									>
										下一页
									</Link>
								</Button>
							)}
						</nav>
					</section>
				</div>
			</div>
		</PageShell>
	);
}

export const Route = createFileRoute("/users/$username/")({
	validateSearch: parseProfileSearch,
	loaderDeps: ({ search }) => ({ tab: search.tab ?? "all", cursor: search.cursor }),
	loader: async ({ context, params, deps }) => {
		try {
			const [profile, page] = await Promise.all([
				context.queryClient.ensureQueryData(publicProfileOptions(params.username)),
				context.queryClient.ensureQueryData(
					publicActivityOptions(params.username, deps.tab, deps.cursor),
				),
			]);
			return { profile, page };
		} catch (error) {
			if (error instanceof ApiError && error.status === 404) throw notFound();
			throw error;
		}
	},
	head: ({ loaderData, params }) => ({
		meta: [
			{ title: `${loaderData?.profile.display_name || params.username} 的个人主页` },
			{
				name: "description",
				content: loaderData?.profile.bio || `${params.username} 的个人主页`,
			},
		],
	}),
	component: UserPublicProfilePage,
});
