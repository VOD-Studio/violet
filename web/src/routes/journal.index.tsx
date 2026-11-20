import { publishedNotesQueryOptions } from "@entities/note/api/queries";
import { projectsQueryOptions } from "@entities/project/api/queries";
import { NOTES_PAGE_LIMIT } from "@features/note-browse/model/display";
import { parseJournalSearch } from "@features/note-browse/model/navigation";
import { NotesPage } from "@features/note-browse/ui/NotesPage";
import { tagKeys } from "@features/tags/api/keys";
import { fetchTags } from "@features/tags/api/queries";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/journal/")({
	validateSearch: parseJournalSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, deps }) => {
		await Promise.all([
			queryClient.ensureQueryData(
				publishedNotesQueryOptions({ ...deps, limit: NOTES_PAGE_LIMIT }),
			),
			queryClient.prefetchQuery(projectsQueryOptions()),
			queryClient.prefetchQuery({ queryKey: tagKeys.list(), queryFn: fetchTags }),
		]);
	},
	head: () => ({
		meta: [
			{ title: "手记" },
			{ name: "description", content: "踩过的坑、随手记下的想法与摘录" },
		],
		links: [{ rel: "canonical", href: `${SITE_URL.replace(/\/+$/, "")}/journal` }],
	}),
	component: JournalRoute,
});

function JournalRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<NotesPage
			search={search}
			onSearchChange={(next) => void navigate({ search: next, resetScroll: false })}
		/>
	);
}
