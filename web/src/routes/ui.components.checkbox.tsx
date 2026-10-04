import { CheckboxDocPage } from "@features/ui-docs/ui/CheckboxDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui/components/checkbox")({
	component: CheckboxDocPage,
});
