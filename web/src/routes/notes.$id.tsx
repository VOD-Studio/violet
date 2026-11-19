import { legacyNotesRedirect } from "@features/note-browse/model/navigation";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/notes/$id")({
	beforeLoad: ({ location, params }) => {
		throw legacyNotesRedirect(location.href, params.id);
	},
	server: {
		handlers: {
			GET: ({ request, params }) => legacyNotesRedirect(request.url, params.id),
		},
	},
});
