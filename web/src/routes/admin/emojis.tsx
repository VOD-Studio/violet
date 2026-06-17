import { createFileRoute } from "@tanstack/react-router";

// 表情管理 (/admin/emojis) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/emojis")({
  component: () => <Placeholder title="表情管理" path="/admin/emojis" />,
});
