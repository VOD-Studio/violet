import { SpecimensPage } from "@features/design-system/ui/pages";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/specimens")({
	component: SpecimensPage,
});
