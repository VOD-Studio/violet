import { createFileRoute } from "@tanstack/react-router";

// 项目列表 (/projects) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_public/projects/")({
  component: () => <Placeholder title="项目" path="/projects" />,
});
