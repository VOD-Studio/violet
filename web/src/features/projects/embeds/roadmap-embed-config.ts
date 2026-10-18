import { z } from "zod";

/** 文章里 `roadmap` 围栏块的参数。 */
export const roadmapEmbedSchema = z
	.object({
		/** 项目 slug */
		project: z
			.string()
			.trim()
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
		/** 条目编号（#N 的 N）；省略时嵌入整个项目 */
		item: z.number().int().positive().optional(),
		/** 形态；card 是条目卡片或项目卡片 */
		display: z.literal("card").default("card"),
	})
	.strict();

export type RoadmapEmbedConfig = z.output<typeof roadmapEmbedSchema>;

/** 校验 JSON 之后的参数；不合法时返回 null，文章里显示可读的降级提示。 */
export function parseRoadmapEmbed(input: unknown): RoadmapEmbedConfig | null {
	const result = roadmapEmbedSchema.safeParse(input);
	return result.success ? result.data : null;
}
