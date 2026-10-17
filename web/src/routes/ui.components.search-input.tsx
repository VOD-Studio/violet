import { SearchInputDocPage } from "@features/ui-docs/ui/SearchInputDoc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui/components/search-input")({
	component: SearchInputDocPage,
});
