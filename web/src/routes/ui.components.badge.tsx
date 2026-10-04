import { BadgeDocPage } from "@features/ui-docs/ui/BadgeDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui/components/badge")({
	component: BadgeDocPage,
});
