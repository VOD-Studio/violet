import { createFileRoute } from "@tanstack/react-router";
import Comments from "@/pages/admin/Comments";

export const Route = createFileRoute("/admin/comments")({
  component: Comments,
});
