import { createFileRoute } from "@tanstack/react-router";
import Posts from "@/pages/admin/Post";

export const Route = createFileRoute("/admin/posts/")({
  component: Posts,
});
