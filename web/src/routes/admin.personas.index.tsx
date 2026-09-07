import { PersonaListPage } from "@features/persona-editor/ui/PersonaListPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/personas/")({
	component: PersonaListPage,
});
