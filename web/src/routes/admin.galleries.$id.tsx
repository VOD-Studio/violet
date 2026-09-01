import { GalleryDraftEditor } from "@features/gallery-editor/ui/GalleryDraftEditor";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/galleries/$id")({
	component: GalleryDraftRoute,
});

function GalleryDraftRoute() {
	const { id } = Route.useParams();
	return <GalleryDraftEditor id={id} />;
}
