import { ButtonDocPage } from "@features/design-system/ui/ButtonDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/specimens/button")({
	component: ButtonDocPage,
});
