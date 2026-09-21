import { PaletteLab } from "@features/lab/palette/ui/PaletteLab";
import { createFileRoute } from "@tanstack/react-router";

/**
 * /lab/colors - 别名路由，指向冷香紫罗兰色彩系统实验室
 */
export const Route = createFileRoute("/lab/colors")({
	component: PaletteLab,
});
