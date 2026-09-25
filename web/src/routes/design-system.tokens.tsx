import { TokensPage } from "@features/design-system/ui/pages";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/tokens")({
	component: TokensPage,
});
