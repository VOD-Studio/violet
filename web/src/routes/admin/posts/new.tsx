import { createFileRoute } from "@tanstack/react-router";

// 新建文章 (/admin/posts/new) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/posts/new")({
  component: () => <Placeholder title="新建文章" path="/admin/posts/new" />,
});
