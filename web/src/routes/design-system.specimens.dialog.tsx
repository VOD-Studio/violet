import { DialogDocPage } from "@features/design-system/ui/DialogDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/specimens/dialog")({
	component: DialogDocPage,
});
