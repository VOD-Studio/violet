import { UploadTileDocPage } from "@features/ui-docs/ui/UploadTileDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui/components/upload-tile")({
	component: UploadTileDocPage,
});
