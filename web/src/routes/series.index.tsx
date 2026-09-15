import { SeriesShelf } from "@features/series/ui/SeriesShelf";
import { PageHeader } from "@shared/ui/page-header";
import { PageShell } from "@shared/ui/page-shell";
import { createFileRoute } from "@tanstack/react-router";

function SeriesIndexPage() {
	return (
		<PageShell>
			<PageHeader eyebrow="Online Books" title="系列书" />
			<SeriesShelf />
		</PageShell>
	);
}

export const Route = createFileRoute("/series/")({
	component: SeriesIndexPage,
});
