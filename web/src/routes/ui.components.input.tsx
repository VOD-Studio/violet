import { InputDocPage } from "@features/ui-docs/ui/InputDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui/components/input")({
	component: InputDocPage,
});
