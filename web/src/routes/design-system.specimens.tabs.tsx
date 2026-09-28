import { TabsDocPage } from "@features/design-system/ui/TabsDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/specimens/tabs")({
	component: TabsDocPage,
});
