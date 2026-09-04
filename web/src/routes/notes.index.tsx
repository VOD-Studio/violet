import { publishedNoteKeys } from "@entities/note/api/keys";
import { fetchPublishedNotes } from "@entities/note/api/queries";
import { NOTES_PAGE_LIMIT, NotesPage } from "@features/note-browse/ui/NotesPage";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/notes/")({
	// 只预取未筛选首页；带 tag 的首屏由客户端按 URL 参数补拉
	loader: async ({ context }) => {
		const query = { limit: NOTES_PAGE_LIMIT };
		await context.queryClient.ensureQueryData({
			queryKey: publishedNoteKeys.list(query),
			queryFn: () => fetchPublishedNotes(query),
		});
	},
	validateSearch: (search: Record<string, unknown>): { tag?: string } => ({
		tag: typeof search.tag === "string" && search.tag ? search.tag : undefined,
	}),
	head: () => ({
		meta: [
			{ title: "笔记" },
			{ name: "description", content: "踩过的坑、根因与修法，一条一个知识点" },
		],
		links: [{ rel: "canonical", href: `${SITE_URL.replace(/\/+$/, "")}/notes` }],
	}),
	component: NotesRoute,
});

function NotesRoute() {
	const { tag } = Route.useSearch();
	return <NotesPage tag={tag} />;
}
