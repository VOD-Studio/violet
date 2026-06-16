import { createFileRoute } from "@tanstack/react-router";

// 邮箱验证 (/verify-email) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_public/verify-email")({
  component: () => <Placeholder title="邮箱验证" path="/verify-email" />,
});
