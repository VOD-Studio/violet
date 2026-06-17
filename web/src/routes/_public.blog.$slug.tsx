import { createFileRoute } from "@tanstack/react-router";

// 文章详情 (/blog/:slug) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_public/blog/$slug")({
  component: () => <Placeholder title="文章详情" path="/blog/:slug" />,
});
