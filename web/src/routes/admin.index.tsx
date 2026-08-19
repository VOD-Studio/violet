import { PageShell } from "@features/admin-layout/ui/PageShell";
import { OverviewBento } from "@features/admin-stats/ui/OverviewBento";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
	component: AdminIndex,
});

function AdminIndex() {
	return (
		<PageShell title="概览">
			<OverviewBento />
		</PageShell>
	);
}
