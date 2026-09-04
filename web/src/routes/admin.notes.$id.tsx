import { NoteEditor } from "@features/admin-notes/ui/NoteEditor";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/notes/$id")({
	component: NoteEditorRoute,
});

function NoteEditorRoute() {
	const { id } = Route.useParams();
	return (
		<div className="h-full px-4 pt-4 pb-6 md:px-6">
			<NoteEditor id={id} />
		</div>
	);
}
