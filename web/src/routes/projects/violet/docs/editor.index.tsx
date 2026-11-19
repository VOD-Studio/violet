import { EditorGuideIndexPage } from "@features/editor-docs/ui/EditorGuideIndexPage";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/violet/docs/editor/")({
	head: () => ({
		meta: [{ title: "文章编辑器手册 · Violet" }],
		links: [{ rel: "canonical", href: `${SITE_URL}/projects/violet/docs/editor` }],
	}),
	component: EditorGuideIndexPage,
});
