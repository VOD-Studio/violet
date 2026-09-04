import { NotesAdminListPage } from "@features/admin-notes/ui/NotesAdminListPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/notes/")({
	component: NotesAdminListPage,
});
