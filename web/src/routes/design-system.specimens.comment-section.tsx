import { CommentSectionDocPage } from "@features/design-system/ui/CommentSectionDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/specimens/comment-section")({
	component: CommentSectionDocPage,
});
