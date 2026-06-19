import { createFileRoute } from "@tanstack/react-router";
import Media from "@/pages/admin/Media";

export const Route = createFileRoute("/admin/media")({
  component: Media,
});
