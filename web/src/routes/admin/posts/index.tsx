import { createFileRoute } from "@tanstack/react-router";

// 文章管理 (/admin/posts) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/posts/")({
  component: () => <Placeholder title="文章管理" path="/admin/posts" />,
});
