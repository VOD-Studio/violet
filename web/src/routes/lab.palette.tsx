import { PaletteLab } from "@features/lab/palette/ui/PaletteLab";
import { createFileRoute } from "@tanstack/react-router";

/**
 * /lab/palette - 冷香紫罗兰色彩系统实验室
 */
export const Route = createFileRoute("/lab/palette")({
	component: PaletteLab,
});
