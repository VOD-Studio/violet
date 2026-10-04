import { TabsDocPage } from "@features/ui-docs/ui/TabsDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui/components/tabs")({
	component: TabsDocPage,
});
