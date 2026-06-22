import ComingSoon from "@shared/ui/coming-soon";
import { createFileRoute } from "@tanstack/react-router";

/**
 * /blog - 博客列表页（占位）
 */
const BlogPage = () => <ComingSoon title="博客" />;

export const Route = createFileRoute("/blog/")({
	component: BlogPage,
});
