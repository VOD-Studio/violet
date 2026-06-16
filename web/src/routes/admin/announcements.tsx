import { createFileRoute } from "@tanstack/react-router";

// 公告管理 (/admin/announcements) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/announcements")({
  component: () => <Placeholder title="公告管理" path="/admin/announcements" />,
});
