import { createFileRoute } from "@tanstack/react-router";
import Roles from "@/pages/admin/Roles";

export const Route = createFileRoute("/admin/roles")({
  component: Roles,
});
