import { createFileRoute } from "@tanstack/react-router";

// 站点设置 (/admin/settings) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/settings")({
  component: () => <Placeholder title="站点设置" path="/admin/settings" />,
});
