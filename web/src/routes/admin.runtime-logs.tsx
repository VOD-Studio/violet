import { RuntimeLogsPage } from "@features/admin-runtime-logs/ui/RuntimeLogsPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/runtime-logs")({ component: RuntimeLogsPage });
