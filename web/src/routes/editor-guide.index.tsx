import { EditorGuideIndexPage } from "@features/editor-docs/ui/EditorGuideIndexPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/editor-guide/")({
	component: EditorGuideIndexPage,
});
