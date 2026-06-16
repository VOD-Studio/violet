import { createFileRoute } from "@tanstack/react-router";

// 音乐 (/music) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_public/music")({
  component: () => <Placeholder title="音乐" path="/music" />,
});
