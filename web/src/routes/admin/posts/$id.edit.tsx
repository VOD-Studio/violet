import { createFileRoute } from "@tanstack/react-router";
import PostEdit from "@/pages/admin/Post/Edit";

export const Route = createFileRoute("/admin/posts/$id/edit")({
  component: PostEdit,
});
