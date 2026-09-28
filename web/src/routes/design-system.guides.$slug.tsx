import { CATALOG_GUIDES } from "@features/design-system/model/guides";
import { LibraryGuidePage } from "@features/design-system/ui/LibraryGuidePage";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/guides/$slug")({
	beforeLoad: ({ params }) => {
		if (!CATALOG_GUIDES.some((guide) => guide.id === params.slug)) throw notFound();
	},
	component: GuideRoute,
});

function GuideRoute() {
	const { slug } = Route.useParams();
	return <LibraryGuidePage slug={slug} />;
}
