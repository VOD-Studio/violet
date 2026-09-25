import { DecisionsPage } from "@features/design-system/ui/pages";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/decisions")({
	component: DecisionsPage,
});
