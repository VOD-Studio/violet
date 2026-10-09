import { SegmentedDocPage } from "@features/ui-docs/ui/SegmentedDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui/components/segmented")({
	component: SegmentedDocPage,
});
