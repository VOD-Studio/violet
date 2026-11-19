import { KanbanDocsPage } from "@features/kanban-docs/ui/KanbanDocsPage";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/kanban/docs")({
	head: () => ({
		meta: [
			{ title: "看板 · @violetjs/kanban" },
			{
				name: "description",
				content: "@violetjs/kanban 的可交互演示、安装说明与 API 文档。",
			},
		],
		links: [{ rel: "canonical", href: `${SITE_URL}/projects/kanban/docs` }],
	}),
	component: KanbanDocsPage,
});
