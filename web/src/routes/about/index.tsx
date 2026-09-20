import { resolveSectionOrder } from "@features/about/model/about-config";
import { AboutPageLayout } from "@features/about/ui/AboutPageLayout";
import { AboutPageError, AboutPageSkeleton } from "@features/about/ui/AboutPageSkeleton";
import { ABOUT_SECTION_IDS, resolveAboutSection } from "@features/about/ui/section-registry";
import { useSettings } from "@features/settings/api/queries";
import { createFileRoute } from "@tanstack/react-router";

function AboutPage() {
	const { data: settings, isLoading, isError, isFetching, refetch } = useSettings();

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

	return (
		<AboutPageLayout hasSections={sections.length > 0}>
			{sections.map(({ id, Component }) => (
				<Component key={id} settings={settings} />
			))}
		</AboutPageLayout>
	);
}

export const Route = createFileRoute("/about/")({
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
