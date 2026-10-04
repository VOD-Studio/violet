import { TextFieldDocPage } from "@features/ui-docs/ui/TextFieldDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui/components/text-field")({
	component: TextFieldDocPage,
});
