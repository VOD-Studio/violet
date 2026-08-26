import { SeriesShelf } from "@features/series/ui/SeriesShelf";
import { PageShell } from "@shared/ui/page-shell";
import { createFileRoute } from "@tanstack/react-router";

function SeriesIndexPage() {
	return (
		<PageShell>
			<header className="mb-10">
				<p className="mb-2 font-mono text-xs tracking-[0.3em] text-muted-foreground uppercase">
					Online Books
				</p>
				<h1 className="font-mono text-4xl font-bold">系列书</h1>
			</header>
			<SeriesShelf />
		</PageShell>
	);
}

export const Route = createFileRoute("/series/")({
	component: SeriesIndexPage,
});
