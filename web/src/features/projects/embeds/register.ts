import { registerArticleEmbed } from "@shared/ui/article-embeds";
import { SquareKanban } from "lucide-react";
import type { RoadmapEmbedConfig } from "./roadmap-embed-config";

/**
 * 在文章里登记 `roadmap` 围栏块，并在编辑器 Slash 菜单里提供「路线图」。服务端与客户端都要执行（由应用入口引入），
 * 实现与选择表单都按需加载，用不到路线图的文章不下载它们。
 */
registerArticleEmbed<RoadmapEmbedConfig>({
	kind: "roadmap",
	languages: ["roadmap"],
	defer: false,
	load: () => import("./roadmap-embed").then((module) => module.roadmapEmbed),
	inserter: {
		title: "路线图",
		description: "嵌入项目路线图的卡片或画布",
		keywords: ["roadmap", "项目", "看板", "进度", "kanban"],
		icon: SquareKanban,
		loadPicker: () =>
			import("./RoadmapEmbedPicker").then((module) => module.RoadmapEmbedPicker),
	},
});
