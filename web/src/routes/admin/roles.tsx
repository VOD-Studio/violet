import { createFileRoute } from "@tanstack/react-router";

// 角色权限 (/admin/roles) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/roles")({
  component: () => <Placeholder title="角色权限" path="/admin/roles" />,
});
