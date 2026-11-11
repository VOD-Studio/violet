import { SEASONS, type Season } from "@shared/lib/theme-preference";
import { CATEGORIES, type Category } from "./category";

/** 陈列室的 URL 状态；季节与明暗省略时跟随站点当前外观。 */
export interface ShowcaseSearch {
	season?: Season;
	mode?: "light" | "dark";
	/** 叠加占地框 */
	outline?: boolean;
	/** 在展品范围内模拟减弱动态 */
	reduced?: boolean;
	category?: Category;
	/** 检视台里的展品 id */
	open?: string;
}

const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
	allowed.find((item) => item === value);

/**
 * 解析陈列室的 URL 参数，非法值一律回落为省略。
 *
 * @remarks 校验跟着路由定义进全站入口包，不用 schema 库，免得入口为一个页面带上整套校验器。
 */
export function parseShowcaseSearch(search: Record<string, unknown>): ShowcaseSearch {
	const result: ShowcaseSearch = {};
	const season = pick(search.season, SEASONS);
	if (season) result.season = season;
	const mode = pick(search.mode, ["light", "dark"] as const);
	if (mode) result.mode = mode;
	if (typeof search.outline === "boolean") result.outline = search.outline;
	if (typeof search.reduced === "boolean") result.reduced = search.reduced;
	const category = pick(
		search.category,
		CATEGORIES.map(({ id }) => id),
	);
	if (category) result.category = category;
	if (typeof search.open === "string") result.open = search.open;
	return result;
}
