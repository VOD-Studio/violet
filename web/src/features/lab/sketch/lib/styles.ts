import { cartoonStyle, createFineliner, inkpen, marker, type Style, styles } from "@violet/sketch";

export type PenId = "fineliner" | "pressure" | "inkpen" | "marker" | "cartoon";
export type HandId = "neat" | "natural" | "draft";

export const PENS: { value: PenId; label: string }[] = [
	{ value: "fineliner", label: "签字笔" },
	{ value: "pressure", label: "签字笔·压感" },
	{ value: "inkpen", label: "压感钢笔" },
	{ value: "marker", label: "马克笔" },
	{ value: "cartoon", label: "卡通" },
];

export const HANDS: { value: HandId; label: string }[] = [
	{ value: "neat", label: "工整" },
	{ value: "natural", label: "自然" },
	{ value: "draft", label: "草稿" },
];

const pressureFineliner = createFineliner({ pressure: 0.45 });

/** 笔与手法的组合；卡通风格自带手法，忽略手法选择。 */
export function buildStyle(pen: PenId, hand: HandId): Style {
	if (pen === "cartoon") return cartoonStyle;
	const base = styles[hand];
	if (pen === "pressure") return { ...base, pen: pressureFineliner };
	if (pen === "inkpen") return { ...base, pen: inkpen };
	if (pen === "marker") return { ...base, pen: marker };
	return base;
}
