import { InklineWorkbench } from "@features/inkline-workbench/ui/InklineWorkbench";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/inkline/docs")({
	head: () => ({
		meta: [
			{ title: "手绘 · @violetjs/inkline" },
			{
				name: "description",
				content:
					"试玩 @violetjs/inkline：笔与压感、手法、填充、整图时间轴，以及导出 GIF 与 WebM 动画。",
			},
		],
		links: [{ rel: "canonical", href: `${SITE_URL}/projects/inkline/docs` }],
	}),
	component: InklineWorkbench,
});
