import { createFileRoute } from "@tanstack/react-router";

// 文章列表 (/blog) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_public/blog/")({
  component: () => <Placeholder title="博客" path="/blog" />,
});
