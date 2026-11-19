import { legacyNotesRedirect } from "@features/note-browse/model/navigation";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/notes/")({
	beforeLoad: ({ location }) => {
		throw legacyNotesRedirect(location.href);
	},
	server: {
		handlers: {
			GET: ({ request }) => legacyNotesRedirect(request.url),
		},
	},
});
