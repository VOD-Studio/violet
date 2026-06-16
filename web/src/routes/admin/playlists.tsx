import { createFileRoute } from "@tanstack/react-router";

// 歌单管理 (/admin/playlists) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/playlists")({
  component: () => <Placeholder title="歌单管理" path="/admin/playlists" />,
});
