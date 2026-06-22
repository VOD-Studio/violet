import ComingSoon from "@shared/ui/coming-soon";
import { createFileRoute } from "@tanstack/react-router";

/**
 * /blog/$slug - 文章详情页（占位）
 *
 * PostCard 的 Link to="/blog/$slug" 引用此路由。
 * 首期不实装实际渲染，仅占位让类型链通。
 */
const BlogDetailPage = () => <ComingSoon title="文章详情" />;

export const Route = createFileRoute("/blog/$slug")({
	component: BlogDetailPage,
});
