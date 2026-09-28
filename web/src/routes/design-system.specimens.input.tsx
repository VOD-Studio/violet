import { InputDocPage } from "@features/design-system/ui/InputDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/specimens/input")({
	component: InputDocPage,
});
