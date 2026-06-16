import { createFileRoute } from "@tanstack/react-router";

// 项目管理 (/admin/projects) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/projects")({
  component: () => <Placeholder title="项目管理" path="/admin/projects" />,
});
