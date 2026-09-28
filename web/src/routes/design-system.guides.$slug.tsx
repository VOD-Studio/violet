import { LIBRARY_GUIDES } from "@features/design-system/model/guides";
import { LibraryGuidePage } from "@features/design-system/ui/LibraryGuidePage";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/guides/$slug")({
	beforeLoad: ({ params }) => {
		if (!LIBRARY_GUIDES.some((guide) => guide.slug === params.slug)) throw notFound();
	},
	component: GuideRoute,
});

function GuideRoute() {
	const { slug } = Route.useParams();
	return <LibraryGuidePage slug={slug} />;
}
