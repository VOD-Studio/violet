import { createFileRoute } from "@tanstack/react-router";
import Settings from "@/pages/admin/Settings";

export const Route = createFileRoute("/admin/settings")({
  component: Settings,
});
