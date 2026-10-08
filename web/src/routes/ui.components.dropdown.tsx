import { DropdownDocPage } from "@features/ui-docs/ui/DropdownDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui/components/dropdown")({
	component: DropdownDocPage,
});
