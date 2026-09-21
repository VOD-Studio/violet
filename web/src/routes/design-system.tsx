import { DesignSystemPage } from "@features/design-system/ui/DesignSystemPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system")({
	component: DesignSystemPage,
});
