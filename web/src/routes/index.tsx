import { SITE_URL } from "@shared/config/env";
import { createFileRoute } from "@tanstack/react-router";
import HomeExperience, {
	HomeExperienceSkeleton,
	recentPublicationsQueryOptions,
	siteIdentityQueryOptions,
} from "@widgets/HomeExperience";

function HomePage() {
	const { initialRecentPublicationsFailed } = Route.useLoaderData();
	return <HomeExperience initialRecentPublicationsFailed={initialRecentPublicationsFailed} />;
}

export const Route = createFileRoute("/")({
	pendingComponent: HomeExperienceSkeleton,
	pendingMs: 150,
	pendingMinMs: 200,
	loader: async ({ context }) => {
		const [identityResult, publicationsResult] = await Promise.allSettled([
			context.queryClient.ensureQueryData(siteIdentityQueryOptions()),
			context.queryClient.ensureQueryData(recentPublicationsQueryOptions()),
		]);
		if (identityResult.status === "rejected") throw identityResult.reason;
		return { initialRecentPublicationsFailed: publicationsResult.status === "rejected" };
	},
	head: () => ({
		meta: [
			{ title: "Violet — 个人创作与读者社区" },
			{
				name: "description",
				content: "文章、系列、笔记、图集与推文组成的个人创作和读者社区。",
			},
		],
		links: [{ rel: "canonical", href: SITE_URL }],
	}),
	component: HomePage,
});
