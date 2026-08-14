import AnnouncementGrid from "@features/admin-announcements/ui/AnnouncementGrid";
import { githubKeys } from "@features/github/api/keys";
import { fetchContributions, fetchRepos } from "@features/github/api/queries";
import Contributions from "@features/github/ui/Contributions";
import RepoList from "@features/github/ui/RepoList";
import { postKeys } from "@features/posts/api/keys";
import { fetchPosts } from "@features/posts/api/queries";
import PostList from "@features/posts/ui/PostList";
import { settingsKeys } from "@features/settings/api/keys";
import { fetchAnnouncements, fetchSettings, useSettings } from "@features/settings/api/queries";
import type { SiteSettings } from "@features/settings/model/types";
import { createFileRoute } from "@tanstack/react-router";
import LandingHero from "@widgets/LandingHero";

function HomePage() {
	// 最新文章条数与「每页文章数」设置保持一致
	const limit = useSettings().data?.posts_per_page;
	return (
		<div className="flex flex-col">
			<LandingHero />
			<section className="container mx-auto flex flex-col gap-32 bg-background px-6 py-32">
				<div>
					<h2 className="mb-12 text-3xl font-bold tracking-tight">公告</h2>
					<AnnouncementGrid />
				</div>

				<div>
					<h2 className="mb-12 text-3xl font-bold tracking-tight">最新文章</h2>
					<PostList query={limit ? { limit } : {}} />
				</div>

				<div>
					<h2 className="mb-12 text-3xl font-bold tracking-tight">开源贡献</h2>
					<Contributions />
				</div>

				<div>
					<h2 className="mb-12 text-3xl font-bold tracking-tight">开源项目</h2>
					<RepoList />
				</div>
			</section>
		</div>
	);
}

export const Route = createFileRoute("/")({
	loader: async ({ context }) => {
		const qc = context.queryClient;
		// 先取站点设置，最新文章条数与 posts_per_page 对齐（与组件 queryKey 一致）
		await qc
			.ensureQueryData({ queryKey: settingsKeys.public(), queryFn: fetchSettings })
			.catch(() => {});
		const postsQuery = (() => {
			const limit = qc.getQueryData<SiteSettings>(settingsKeys.public())?.posts_per_page;
			return limit ? { limit } : {};
		})();
		await qc
			.ensureQueryData({
				queryKey: postKeys.list(postsQuery),
				queryFn: () => fetchPosts(postsQuery),
			})
			.catch(() => {});

		context.queryClient
			.ensureQueryData({
				queryKey: settingsKeys.announcements(),
				queryFn: fetchAnnouncements,
			})
			.catch(() => {});
		context.queryClient
			.ensureQueryData({ queryKey: githubKeys.contributions(), queryFn: fetchContributions })
			.catch(() => {});
		context.queryClient
			.ensureQueryData({ queryKey: githubKeys.repos(), queryFn: fetchRepos })
			.catch(() => {});
	},
	component: HomePage,
});
