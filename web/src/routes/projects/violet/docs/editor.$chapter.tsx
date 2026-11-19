import { findEditorGuideChapter } from "@features/editor-docs/model/chapters";
import { EditorGuideChapterPage } from "@features/editor-docs/ui/EditorGuideChapterPage";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/violet/docs/editor/$chapter")({
	beforeLoad: ({ params }) => {
		if (!findEditorGuideChapter(params.chapter)) throw notFound();
	},
	head: ({ params }) => ({
		meta: [
			{
				title: `${findEditorGuideChapter(params.chapter)?.title ?? "文章编辑器手册"} · Violet`,
			},
		],
		links: [
			{ rel: "canonical", href: `${SITE_URL}/projects/violet/docs/editor/${params.chapter}` },
		],
	}),
	component: ChapterRoute,
});

function ChapterRoute() {
	const { chapter } = Route.useParams();
	return <EditorGuideChapterPage chapterId={chapter} />;
}
