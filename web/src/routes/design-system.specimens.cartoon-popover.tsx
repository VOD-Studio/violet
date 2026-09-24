import { CartoonPopoverDocPage } from "@features/design-system/ui/CartoonPopoverDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/specimens/cartoon-popover")({
	component: CartoonPopoverDocPage,
});
