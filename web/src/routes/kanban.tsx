import { KanbanDocsPage } from "@features/kanban-docs/ui/KanbanDocsPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/kanban")({
	head: () => ({
		meta: [
			{ title: "看板 · @violetjs/kanban" },
			{
				name: "description",
				content: "@violetjs/kanban 的可交互演示、安装说明与 API 文档。",
			},
		],
	}),
	component: KanbanDocsPage,
});
