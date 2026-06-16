import { createFileRoute } from "@tanstack/react-router";

// 编辑文章 (/admin/posts/:id/edit) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/posts/$id/edit")({
  component: () => (
    <Placeholder title="编辑文章" path="/admin/posts/:id/edit" />
  ),
});
