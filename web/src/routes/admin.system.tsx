import { SystemMonitorPage } from "@features/admin-system/ui/SystemMonitorPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/system")({
    component: SystemMonitorPage,
});
