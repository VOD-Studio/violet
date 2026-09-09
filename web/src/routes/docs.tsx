import { ApiReference } from "@features/api-docs/ui/ApiReference";
import { SITE_URL } from "@shared/config/env";
import { FloatingBack } from "@shared/ui/floating-back";
import { createFileRoute } from "@tanstack/react-router";

function DocsPage() {
	return (
		<div className="relative min-h-[calc(100svh-4rem)] bg-paper text-paper-foreground">
			<div className="mx-auto max-w-3xl px-5 pt-14 pb-4 sm:px-8">
				<ApiReference variant="page" />
			</div>
			<FloatingBack to="/" label="返回首页" />
		</div>
	);
}

export const Route = createFileRoute("/docs")({
	head: () => ({
		meta: [
			{ title: "API 文档 — Violet" },
			{
				name: "description",
				content: "Violet 站点 API 参考文档：公开端点与附录管理端点，随线上版本实时更新。",
			},
		],
		links: [{ rel: "canonical", href: `${SITE_URL}/docs` }],
	}),
	component: DocsPage,
});
