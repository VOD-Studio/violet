import { ImagePixelRevealDocPage } from "@features/ui-docs/ui/ImagePixelRevealDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui/components/image-pixel-reveal")({
	component: ImagePixelRevealDocPage,
});
