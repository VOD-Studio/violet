import { createFileRoute } from "@tanstack/react-router";

// 项目详情 (/projects/:id) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_public/projects/$id")({
  component: () => <Placeholder title="项目详情" path="/projects/:id" />,
});
