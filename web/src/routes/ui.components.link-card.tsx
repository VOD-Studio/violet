import { LinkCardDocPage } from "@features/ui-docs/ui/LinkCardDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui/components/link-card")({
	component: LinkCardDocPage,
});
