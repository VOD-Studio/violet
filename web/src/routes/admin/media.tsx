import { createFileRoute } from "@tanstack/react-router";

// 媒体库 (/admin/media) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/media")({
  component: () => <Placeholder title="媒体库" path="/admin/media" />,
});
