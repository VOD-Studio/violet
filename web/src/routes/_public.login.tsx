import { createFileRoute } from "@tanstack/react-router";

// 登录 (/login) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_public/login")({
  component: () => <Placeholder title="登录" path="/login" />,
});
