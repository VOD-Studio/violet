import { intentCovers, type SharedIntent } from "./intent";
import { matchesAny } from "./patterns";

/** 页面转场的两种形态：不做转场，或交叉淡入淡出。共享元素 morph 叠加在淡入淡出之上。 */
export type TransitionKind = "none" | "fade";

export interface TransitionRule {
	/** 规则名，便于排查与测试。 */
	id: string;
	kind: TransitionKind;
	/** 导航两端满足条件时命中；按数组顺序取第一条命中的规则。 */
	applies(from: string | undefined, to: string): boolean;
}

const ADMIN = ["/admin", "/admin/*"];
const LAB = ["/lab", "/lab/*"];
const UI_DOCS = ["/ui", "/ui/*"];

const eitherIn = (patterns: readonly string[]) => (from: string | undefined, to: string) =>
	matchesAny(patterns, to) || matchesAny(patterns, from);

/**
 * 不做转场的例外清单；没有命中的导航默认交叉淡入淡出。
 *
 * 新页面默认就有转场，只有明确不该有的才加到这里。
 */
export const TRANSITION_RULES: readonly TransitionRule[] = [
	// 后台是独立布局，没有前台的 Header 与页脚，整页切换不做转场。
	{ id: "admin", kind: "none", applies: eitherIn(ADMIN) },
	// 实验页不属于正式页面，也不应带上转场样式。
	{ id: "lab", kind: "none", applies: eitherIn(LAB) },
	// 组件库文档站内部切换由侧栏主导，内容直接切换。
	{
		id: "ui-docs-internal",
		kind: "none",
		applies: (from, to) => matchesAny(UI_DOCS, from) && matchesAny(UI_DOCS, to),
	},
];

/** 一次导航采用的转场形态。 */
export function resolveTransitionKind(from: string | undefined, to: string): TransitionKind {
	return TRANSITION_RULES.find((rule) => rule.applies(from, to))?.kind ?? "fade";
}

export interface ResolveInput {
	from: string | undefined;
	to: string;
	/** 路径是否变化；只改查询参数或哈希的导航不做转场。 */
	pathChanged: boolean;
	/** 整理后仍有效的共享元素意图。 */
	intent: SharedIntent | null;
}

/**
 * 计算传给 View Transition 的 type 列表，返回 false 表示这次导航不做转场。
 *
 * - `fade`：普通页面切换，旧页淡出、新页淡入；
 * - `morph`：来源与目标都在某个共享元素意图的范围内，共享元素 morph，页面其余部分更快淡入淡出。
 */
export function resolveViewTransitionTypes({
	from,
	to,
	pathChanged,
	intent,
}: ResolveInput): string[] | false {
	if (!pathChanged) return false;
	if (resolveTransitionKind(from, to) === "none") return false;
	return [intentCovers(intent, from, to) ? "morph" : "fade"];
}
