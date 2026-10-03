import { DialogDocPage } from "@features/ui-docs/ui/DialogDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui/components/dialog")({
	component: DialogDocPage,
});
