import diagram from "@features/editor/docs/diagram.md?raw";
import math from "@features/editor/docs/math.md?raw";
import personaCards from "@features/editor/docs/persona-cards.md?raw";
import storage from "@features/editor/docs/storage.md?raw";
import syntax from "@features/editor/docs/syntax.md?raw";

/**
 * 各章正文（构建期 ?raw 导入），键为章节 id。
 *
 * @remarks 只由章节页引用：章节清单会被路由校验带进全站入口包，正文不能跟着进去。
 */
export const EDITOR_GUIDE_SOURCES: Readonly<Record<string, string>> = {
	syntax,
	math,
	diagram,
	"persona-cards": personaCards,
	storage,
};
