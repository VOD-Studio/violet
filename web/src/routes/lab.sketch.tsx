import { SketchBenchPage } from "@features/lab/sketch/ui/SketchBenchPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lab/sketch")({
	ssr: false,
	component: SketchBenchPage,
});
