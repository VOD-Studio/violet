import { createFileRoute } from "@tanstack/react-router";
import Projects from "@/pages/admin/Projects";

export const Route = createFileRoute("/admin/projects")({
  component: Projects,
});
