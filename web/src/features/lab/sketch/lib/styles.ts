import {
	createFineliner,
	createGPen,
	createInkPen,
	createMarker,
	lineWashStyle,
	type PenFactory,
	type Style,
	styles,
} from "@violetjs/inkline";

export type PenId = "fineliner" | "inkpen" | "marker" | "gpen";
export type HandId = "neat" | "natural" | "draft" | "inking";

export const PENS: { value: PenId; label: string; create: PenFactory }[] = [
	{ value: "fineliner", label: "签字笔", create: createFineliner },
	{ value: "inkpen", label: "钢笔", create: createInkPen },
	{ value: "marker", label: "马克笔", create: createMarker },
	{ value: "gpen", label: "G 笔", create: createGPen },
];

export const HANDS: { value: HandId; label: string }[] = [
	{ value: "neat", label: "工整" },
	{ value: "natural", label: "自然" },
	{ value: "draft", label: "草稿" },
	{ value: "inking", label: "勾线" },
];

const penFactory = (pen: PenId) =>
	PENS.find((entry) => entry.value === pen)?.create ?? createFineliner;

/** 笔的缺省压感强度；切换笔时压感回到这里。 */
export const defaultPressure = (pen: PenId) => penFactory(pen)().pressure ?? 0;

/** 笔、压感与手法的组合；填充排线沿用所选的笔，勾线取线稿淡彩预设的排线手法与填充线宽。 */
export function buildStyle(pen: PenId, pressure: number, hand: HandId): Style {
	const ink = penFactory(pen)({ pressure });
	const base = hand === "inking" ? lineWashStyle : styles[hand];
	return { ...base, pen: ink, fillPen: ink };
}
