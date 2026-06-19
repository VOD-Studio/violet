import { createFileRoute } from "@tanstack/react-router";
import Tags from "@/pages/admin/Tags";

export const Route = createFileRoute("/admin/tags")({
  component: Tags,
});
