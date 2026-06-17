import { createFileRoute } from "@tanstack/react-router";

// 用户管理 (/admin/users) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/users")({
  component: () => <Placeholder title="用户管理" path="/admin/users" />,
});
