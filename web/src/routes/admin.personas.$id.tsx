import { PersonaEditorPage } from "@features/persona-editor/ui/PersonaEditorPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/personas/$id")({
	component: PersonaEditorRoute,
});

function PersonaEditorRoute() {
	const { id } = Route.useParams();
	return <PersonaEditorPage id={id} />;
}
