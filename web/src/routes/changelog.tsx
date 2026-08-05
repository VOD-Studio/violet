import { ChangelogPage } from "@features/changelog/ui/ChangelogPage";
import { fetchReleases, releasesKeys } from "@shared/api/releases";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/changelog")({
	loader: async ({ context }) => {
		await context.queryClient
			.ensureQueryData({ queryKey: releasesKeys.all, queryFn: fetchReleases })
			.catch(() => {});
	},
	component: ChangelogPage,
});
