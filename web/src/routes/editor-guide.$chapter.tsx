import { findEditorGuideChapter } from "@features/editor-docs/model/chapters";
import { EditorGuideChapterPage } from "@features/editor-docs/ui/EditorGuideChapterPage";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/editor-guide/$chapter")({
	beforeLoad: ({ params }) => {
		if (!findEditorGuideChapter(params.chapter)) throw notFound();
	},
	component: ChapterRoute,
});

function ChapterRoute() {
	const { chapter } = Route.useParams();
	return <EditorGuideChapterPage chapterId={chapter} />;
}
