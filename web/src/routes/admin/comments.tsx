import { createFileRoute } from "@tanstack/react-router";

// 评论管理 (/admin/comments) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/comments")({
  component: () => <Placeholder title="评论管理" path="/admin/comments" />,
});
