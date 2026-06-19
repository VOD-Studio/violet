import { createFileRoute } from "@tanstack/react-router";
import Logs from "@/pages/admin/Logs";

export const Route = createFileRoute("/admin/logs")({
  component: Logs,
});
