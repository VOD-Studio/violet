import { publishedNoteKeys } from "@entities/note/api/keys";
import { fetchPublishedNote } from "@entities/note/api/queries";
import type { PublicNote } from "@entities/note/model/types";
import { noteExcerpt, noteTitle } from "@features/note-browse/model/display";
import { NoteDetailPage } from "@features/note-browse/ui/NoteDetailPage";
import { ApiError } from "@shared/api/error";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/notes/$id")({
	loader: async ({ context, params }) => {
		try {
			return await context.queryClient.ensureQueryData({
				queryKey: publishedNoteKeys.detail(params.id),
				queryFn: () => fetchPublishedNote(params.id),
			});
		} catch (error) {
			if (error instanceof ApiError && error.status === 404) throw notFound();
			throw error;
		}
	},
	head: ({ loaderData }) => {
		const note = loaderData as PublicNote | null;
		if (!note) return { meta: [] };
		const title = noteTitle(note);
		const description = noteExcerpt(note.content_html, 120);
		const pageUrl = `${SITE_URL.replace(/\/+$/, "")}/notes/${note.id}`;
		return {
			meta: [
				{ title },
				{ name: "description", content: description },
				{ property: "og:title", content: title },
				{ property: "og:description", content: description },
				{ property: "og:type", content: "article" },
				{ property: "og:url", content: pageUrl },
			],
			links: [{ rel: "canonical", href: pageUrl }],
		};
	},
	component: NoteDetailRoute,
});

function NoteDetailRoute() {
	const { id } = Route.useParams();
	return <NoteDetailPage noteId={id} />;
}
