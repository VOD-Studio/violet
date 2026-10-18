import { z } from "zod";

/** 文章里 `roadmap` 围栏块的参数。 */
export const roadmapEmbedSchema = z
	.object({
		/** 项目 slug */
		project: z
			.string()
			.trim()
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
		/** 条目编号（#N 的 N）；卡片里给出时是条目卡片，关系画布里给出时以它为根 */
		item: z.number().int().positive().optional(),
		/** 形态：card 是条目卡片或项目卡片，canvas 是可平移缩放的画布 */
		display: z.enum(["card", "canvas"]).default("card"),
		/** 画布内容：board 是三阶段看板（默认），graph 是关系图；只用于 canvas */
		view: z.enum(["board", "graph"]).optional(),
	})
	.strict()
	.refine((config) => config.display === "canvas" || config.view === undefined, {
		message: "view 只用于 display 为 canvas 的画布",
	})
	// 看板画布总是整个项目；要聚焦某个条目请用关系画布
	.refine(
		(config) =>
			!(config.display === "canvas" && config.view !== "graph" && config.item !== undefined),
		{ message: "看板画布不接受 item，以条目为根请用 view: graph" },
	);

export type RoadmapEmbedConfig = z.output<typeof roadmapEmbedSchema>;

/** 校验 JSON 之后的参数；不合法时返回 null，文章里显示可读的降级提示。 */
export function parseRoadmapEmbed(input: unknown): RoadmapEmbedConfig | null {
	const result = roadmapEmbedSchema.safeParse(input);
	return result.success ? result.data : null;
}
