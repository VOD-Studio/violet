import { ButtonDocPage } from "@features/ui-docs/ui/ButtonDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui/components/button")({
	component: ButtonDocPage,
});
