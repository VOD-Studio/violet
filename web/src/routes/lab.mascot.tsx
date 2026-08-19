import { MascotLab } from "@features/lab/mascot/ui/MascotLab";
import { LabHeader } from "@features/lab/ui/LabHeader";
import { createFileRoute } from "@tanstack/react-router";

/**
 * /lab/mascot - 吉祥物形象实验室
 *
 * 深色画布独立风格,内容区不遵循主站设计语言。
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
