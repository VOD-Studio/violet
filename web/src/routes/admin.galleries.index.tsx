import { GalleryDraftListPage } from "@features/gallery-editor/ui/GalleryDraftListPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/galleries/")({
	component: GalleryDraftListPage,
});
