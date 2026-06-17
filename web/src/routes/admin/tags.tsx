import { createFileRoute } from "@tanstack/react-router";

// 标签管理 (/admin/tags) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/tags")({
  component: () => <Placeholder title="标签管理" path="/admin/tags" />,
});
