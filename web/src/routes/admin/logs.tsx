import { createFileRoute } from "@tanstack/react-router";

// 操作日志 (/admin/logs) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/logs")({
  component: () => <Placeholder title="操作日志" path="/admin/logs" />,
});
