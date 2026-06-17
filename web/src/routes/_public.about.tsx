import { createFileRoute } from "@tanstack/react-router";

// 关于 (/about) — 待迁移
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_public/about")({
  component: () => <Placeholder title="关于" path="/about" />,
});
