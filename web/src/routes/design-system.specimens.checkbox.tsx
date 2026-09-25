import { CheckboxDocPage } from "@features/design-system/ui/CheckboxDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/specimens/checkbox")({
	component: CheckboxDocPage,
});
