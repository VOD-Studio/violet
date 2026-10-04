import { ComponentsIndex } from "@features/ui-docs/ui/ComponentsIndex";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui/components/")({
	component: ComponentsIndex,
});
