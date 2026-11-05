import { SEASONS } from "@shared/lib/theme-preference";
import { z } from "zod";
import { CATEGORIES, type Category } from "./exhibit";

const CATEGORY_IDS = CATEGORIES.map((category) => category.id) as [Category, ...Category[]];

/**
 * 陈列室的 URL 状态；季节与明暗省略时跟随站点当前外观，非法值一律回落为省略。
 */
export const showcaseSearchSchema = z.object({
	season: z.enum(SEASONS).optional().catch(undefined),
	mode: z.enum(["light", "dark"]).optional().catch(undefined),
	/** 叠加占地框 */
	outline: z.boolean().optional().catch(undefined),
	/** 在展品范围内模拟减弱动态 */
	reduced: z.boolean().optional().catch(undefined),
	category: z.enum(CATEGORY_IDS).optional().catch(undefined),
	/** 检视台里的展品 id */
	open: z.string().optional().catch(undefined),
});

export type ShowcaseSearch = z.infer<typeof showcaseSearchSchema>;
