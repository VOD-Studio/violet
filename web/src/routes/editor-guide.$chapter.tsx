import { findEditorGuideChapter } from "@features/editor-docs/model/chapters";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/editor-guide/$chapter")({
	beforeLoad: ({ location, params }) => {
		if (!findEditorGuideChapter(params.chapter)) throw notFound();
		const target = new URL(location.href, "http://localhost");
		target.pathname = `/projects/violet/docs/editor/${encodeURIComponent(params.chapter)}`;
		throw redirect({
			href: `${target.pathname}${target.search}${target.hash}`,
			statusCode: 301,
		});
	},
});
