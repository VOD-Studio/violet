import type { Locale } from "../../locale.ts";

/** 线型：实线加箭头、虚线加箭头、实线加挡条。线型本身区分类型，不靠颜色。 */
export type RelationLine = "solid" | "dashed" | "blocker";

/** 一种关系类型的展示：读法与线型。 */
export interface RelationTypeStyle {
	/**
	 * 从来源读：「来源 {label} 目标」。
	 * @example "extends"
	 */
	label: string;
	/**
	 * 从目标读：「目标 {inverseLabel} 来源」。
	 * @example "is extended by"
	 */
	inverseLabel: string;
	line: RelationLine;
}

const defaults: Record<Locale, Record<string, RelationTypeStyle>> = {
	en: {
		extends: { label: "extends", inverseLabel: "is extended by", line: "solid" },
		fixes: { label: "fixes", inverseLabel: "is fixed by", line: "dashed" },
		blocks: { label: "blocks", inverseLabel: "is blocked by", line: "blocker" },
	},
	"zh-CN": {
		extends: { label: "扩展", inverseLabel: "被扩展", line: "solid" },
		fixes: { label: "修复", inverseLabel: "被修复", line: "dashed" },
		blocks: { label: "阻塞", inverseLabel: "被阻塞", line: "blocker" },
	},
};

/** 内置的 extends、fixes、blocks 加上使用方的映射；同名类型以使用方为准。 */
export function resolveRelationTypes(
	locale: Locale = "en",
	overrides?: Readonly<Record<string, RelationTypeStyle>>,
): Record<string, RelationTypeStyle> {
	return { ...(defaults[locale] ?? defaults.en), ...overrides };
}

/** 取一种类型的展示；没有映射的类型按实线处理，类型名当文字。 */
export function relationStyle(
	types: Readonly<Record<string, RelationTypeStyle>>,
	type: string,
): RelationTypeStyle {
	// 自有属性才算映射：类型名恰好叫 constructor、toString 时不能取到 Object 原型上的函数
	return Object.hasOwn(types, type)
		? types[type]
		: { label: type, inverseLabel: type, line: "solid" };
}
