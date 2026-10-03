import { TextFieldDocPage } from "@features/design-system/ui/TextFieldDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/specimens/text-field")({
	component: TextFieldDocPage,
});
