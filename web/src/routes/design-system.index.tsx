import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/")({
	beforeLoad: () => {
		throw redirect({
			to: "/design-system/principles",
			replace: true,
		});
	},
});
