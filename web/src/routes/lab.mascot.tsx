import { MascotLab } from "@features/lab/mascot/ui/MascotLab";
import { LabHeader } from "@features/lab/ui/LabHeader";
import { createFileRoute } from "@tanstack/react-router";

/**
 * /lab/mascot - 吉祥物形象实验室
 *
 * 深色聚光灯舞台 sticky 常驻视线，亮色表情目录滚动浏览——hover 即预览、点击固定。
 */
function MascotLabPage() {
	return (
		<div className="container mx-auto px-6 py-24">
			<LabHeader to="/lab/mascot" />
			<MascotLab />
		</div>
	);
}

export const Route = createFileRoute("/lab/mascot")({
	component: MascotLabPage,
});
