import { createFileRoute } from "@tanstack/react-router";

// 注册 (/register) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_public/register")({
  component: () => <Placeholder title="注册" path="/register" />,
});
