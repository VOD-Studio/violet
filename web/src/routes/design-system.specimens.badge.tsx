import { BadgeDocPage } from "@features/design-system/ui/BadgeDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/specimens/badge")({
	component: BadgeDocPage,
});
