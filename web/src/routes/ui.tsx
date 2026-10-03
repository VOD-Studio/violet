import { UiDocsLayout } from "@features/ui-docs/ui/UiDocsLayout";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ui")({
	beforeLoad: ({ location }) => {
		if (location.pathname === "/ui" || location.pathname === "/ui/") {
			throw redirect({
				to: "/ui/guides/$slug",
				params: { slug: "introduction" },
				replace: true,
			});
		}
	},
	component: UiDocsLayout,
});
