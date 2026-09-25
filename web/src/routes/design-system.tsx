import { DesignSystemLayout } from "@features/design-system/ui/DesignSystemLayout";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system")({
	beforeLoad: ({ location }) => {
		if (location.pathname === "/design-system" || location.pathname === "/design-system/") {
			throw redirect({
				to: "/design-system/principles",
				replace: true,
			});
		}
	},
	component: DesignSystemLayout,
});
