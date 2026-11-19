import { siteIdentityQueryOptions } from "@entities/site-identity/api/queries";
import { gardenGrowthQueryOptions } from "@features/about/api/growth";
import { resolveSectionOrder } from "@features/about/model/about-config";
import { AboutPageLayout } from "@features/about/ui/AboutPageLayout";
import { AboutPageError, AboutPageSkeleton } from "@features/about/ui/AboutPageSkeleton";
import { GardenGrowthSection } from "@features/about/ui/GardenGrowthSection";
import { ABOUT_SECTION_IDS, resolveAboutSection } from "@features/about/ui/section-registry";
import { settingsKeys } from "@features/settings/api/keys";
import { fetchSettings, useSettings } from "@features/settings/api/queries";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { GardenerSection, GrowingSection } from "./-garden-sections";

interface AboutSearch {
	growth?: string;
}

function AboutPage() {
	const { data: settings, isLoading, isError, isFetching, refetch } = useSettings();
	const { growth: requestedDate } = Route.useSearch();
	const growth = useQuery(gardenGrowthQueryOptions());

	if (isLoading) {
		return <AboutPageSkeleton />;
	}
	if (isError || !settings) {
		return <AboutPageError isRetrying={isFetching} onRetry={() => void refetch()} />;
	}

	const configuredIds =
		settings.about_config === null
			? [...ABOUT_SECTION_IDS]
			: resolveSectionOrder(settings.about_config);
	const sections = configuredIds.flatMap((id) => {
		const section = resolveAboutSection(id, settings);
		return section ? [section] : [];
	});
	const releases = sections.find(({ id }) => id === "changelog");
	const ReleaseSection = releases?.Component;

	return (
		<AboutPageLayout
			elapsedDays={growth.data?.elapsed_days ?? null}
			growthSection={<GardenGrowthSection query={growth} requestedDate={requestedDate} />}
			gardenSections={
				<>
					<GardenerSection />
					{ReleaseSection && <ReleaseSection settings={settings} />}
					<GrowingSection />
				</>
			}
		>
			{sections
				.filter(({ id }) => id !== "changelog")
				.map(({ id, Component }) => (
					<Component key={id} settings={settings} />
				))}
		</AboutPageLayout>
	);
}

export const Route = createFileRoute("/about/")({
	validateSearch: (search: Record<string, unknown>): AboutSearch =>
		typeof search.growth === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.growth)
			? { growth: search.growth }
			: {},
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData({
				queryKey: settingsKeys.public(),
				queryFn: fetchSettings,
			}),
			context.queryClient.prefetchQuery(siteIdentityQueryOptions()),
			context.queryClient.prefetchQuery(gardenGrowthQueryOptions()),
		]);
	},
	head: () => ({
		meta: [
			{ title: "关于" },
			{
				name: "description",
				content: "关于 xunrua、Violet，以及写代码和写字这两件长期的事。",
			},
		],
	}),
	component: AboutPage,
});
