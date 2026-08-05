/**
 * about_config - 关于页区块版面配置的排序解析
 *
 * 后端 API 返回原生 JSON 对象（json.RawMessage），前端无需二次 parse。
 * 类型 AboutConfig / AboutSection 定义在 settings/model（entities 层），
 * 本模块仅提供区块排序的业务函数。
 *
 * 结构：{ sections: [{ id, enabled, order, params }] }
 */
export type { AboutConfig, AboutSection } from "@features/settings/model/types";

import type { AboutConfig } from "@features/settings/model/types";

/**
 * 按 order 升序排序区块（order 缺省视为 0），过滤出 enabled 的区块。
 * 返回的 id 列表供前台按序渲染对应区块组件。
 */
export function resolveSectionOrder(config: AboutConfig | null | undefined): string[] {
	if (!config?.sections) return [];
	return [...config.sections]
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
		.filter((s) => s.enabled)
		.map((s) => s.id);
}
