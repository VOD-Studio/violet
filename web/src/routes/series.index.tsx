import { SeriesShelf } from "@features/series/ui/SeriesShelf";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageShell } from "@violet/ui";

function SeriesIndexPage() {
	return (
		<PageShell>
			<PageHeader title="系列书" />
			<SeriesShelf />
		</PageShell>
	);
}

export const Route = createFileRoute("/series/")({
	component: SeriesIndexPage,
});
