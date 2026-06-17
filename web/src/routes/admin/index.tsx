import { createFileRoute } from "@tanstack/react-router";

// 仪表盘 (/admin) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/")({
  component: () => <Placeholder title="仪表盘" path="/admin" />,
});
