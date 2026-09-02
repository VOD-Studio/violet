import { NoteEditor } from "@features/admin-notes/ui/NoteEditor";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/notes/$id")({
	component: NoteEditorRoute,
});

function NoteEditorRoute() {
	const { id } = Route.useParams();
	return <NoteEditor id={id} />;
}
