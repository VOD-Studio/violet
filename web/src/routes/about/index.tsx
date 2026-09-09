import { resolveSectionOrder } from "@features/about/model/about-config";
import styles from "@features/about/ui/AboutPage.module.css";
import { AboutPageSkeleton } from "@features/about/ui/AboutPageSkeleton";
import { ABOUT_SECTION_IDS, resolveSectionComponent } from "@features/about/ui/section-registry";
import { useSettings } from "@features/settings/api/queries";
import { createFileRoute } from "@tanstack/react-router";

function AboutPage() {
	const { data: settings, isLoading } = useSettings();

	if (isLoading) {
		return (
			<main className={styles.page} data-about-page>
				<AboutPageSkeleton />
			</main>
		);
	}

	if (!settings) {
		return <main className={styles.page} data-about-page />;
	}

	const orderedIds = resolveSectionOrder(settings.about_config);
	const ids = orderedIds.length > 0 ? orderedIds : [...ABOUT_SECTION_IDS];

	return (
		<main className={styles.page} data-about-page>
			<div className={styles.document}>
				{ids.map((id) => {
					const Component = resolveSectionComponent(id);
					if (!Component) return null;
					return (
						<Component key={id} section={{ id, enabled: true }} settings={settings} />
					);
				})}
			</div>
		</main>
	);
}

export const Route = createFileRoute("/about/")({
	head: () => ({
		meta: [{ title: "关于" }],
	}),
	component: AboutPage,
});
