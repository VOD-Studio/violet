import { SketchPrototypePage } from "@features/lab/sketch-prototype/ui/SketchPrototypePage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lab/sketch-prototype")({
	ssr: false,
	validateSearch: (search: Record<string, unknown>) => ({
		variant: typeof search.variant === "string" ? search.variant : "comic",
	}),
	component: SketchPrototypePage,
});
