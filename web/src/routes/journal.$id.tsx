import { publishedNoteQueryOptions } from "@entities/note/api/queries";
import type { PublicNote } from "@entities/note/model/types";
import { notePreview, noteTitle } from "@features/note-browse/model/display";
import { journalNoteUrl } from "@features/note-browse/model/navigation";
import { NoteDetailPage } from "@features/note-browse/ui/NoteDetailPage";
import { tagKeys } from "@features/tags/api/keys";
import { fetchTags } from "@features/tags/api/queries";
import { ApiError } from "@shared/api/error";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/journal/$id")({
	staticData: { navTitle: (note: PublicNote | null) => note && noteTitle(note) },
	loader: async ({ context: { queryClient }, params }) => {
		try {
			const [note] = await Promise.all([
				queryClient.ensureQueryData(publishedNoteQueryOptions(params.id)),
				queryClient.prefetchQuery({ queryKey: tagKeys.list(), queryFn: fetchTags }),
			]);
			return note;
		} catch (error) {
			if (error instanceof ApiError && error.status === 404) throw notFound();
			throw error;
		}
	},
	head: ({ loaderData: note }) => {
		if (!note) return { meta: [] };
		const { title, excerpt } = notePreview(note, 120);
		const pageUrl = journalNoteUrl(note.id);
		return {
			meta: [
				{ title },
				{ name: "description", content: excerpt },
				{ property: "og:title", content: title },
				{ property: "og:description", content: excerpt },
				{ property: "og:type", content: "article" },
				{ property: "og:url", content: pageUrl },
			],
			links: [{ rel: "canonical", href: pageUrl }],
		};
	},
	component: JournalDetailRoute,
});

function JournalDetailRoute() {
	const { id } = Route.useParams();
	return <NoteDetailPage noteId={id} />;
}
