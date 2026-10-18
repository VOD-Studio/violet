import { registerArticleEmbed } from "@shared/ui/article-embeds";
import type { RoadmapEmbedConfig } from "./roadmap-embed-config";

/**
 * 在文章里登记 `roadmap` 围栏块。服务端与客户端都要执行（由应用入口引入），
 * 实现按需加载，用不到路线图的文章不下载它。
 */
registerArticleEmbed<RoadmapEmbedConfig>({
	kind: "roadmap",
	languages: ["roadmap"],
	load: () => import("./roadmap-embed").then((module) => module.roadmapEmbed),
});
