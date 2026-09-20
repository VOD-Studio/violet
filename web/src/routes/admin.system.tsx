import { SystemPanelPage } from "@features/admin-system/ui/SystemPanelPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/system")({
	component: SystemPanelPage,
});
