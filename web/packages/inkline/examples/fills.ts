import {
	createPatternFill,
	draw,
	fills,
	lineWashStyle,
	rect,
	type SceneItem,
	styles,
} from "@violetjs/inkline";
import { renderSvg } from "@violetjs/inkline/svg";

// #region readme
const style = styles.natural;
const items: SceneItem[] = [
	{
		id: "a",
		path: rect(20, 20, 100, 80),
		fillRole: "sky",
		style: { ...style, fill: fills.hachure },
	},
	{
		id: "b",
		path: rect(150, 20, 100, 80),
		fillRole: "rose",
		style: { ...style, fill: fills["cross-hatch"] },
	},
	{
		id: "c",
		path: rect(280, 20, 100, 80),
		fillRole: "mint",
		style: { ...style, fill: fills.dots },
	},
	{
		id: "d",
		path: rect(410, 20, 100, 80),
		fillRole: "sun",
		style: { ...style, fill: fills.solid },
	},
	{
		id: "e",
		path: rect(20, 130, 100, 80),
		fillRole: "sky",
		style: { ...style, fill: createPatternFill("hachure", { gap: 10, angle: 60 }) }, // wider gap, steeper lines
	},
	{
		id: "f",
		path: rect(150, 130, 100, 80),
		fillRole: "rose",
		style: { ...style, fill: fills.zigzag },
	},
	{
		id: "g",
		path: rect(280, 130, 100, 80),
		fillRole: "mint",
		style: { ...style, fill: fills.dashed },
	},
	{ id: "h", path: rect(410, 130, 100, 80), fillRole: "sun", style: lineWashStyle }, // wash
];
// #endregion

export const svg = renderSvg(draw({ width: 530, height: 230, items }, { style, seed: 7 }), {
	paper: "#fffdf7",
	ink: "#2f2b3a",
	sky: "#9fc9e8",
	rose: "#eea7b8",
	mint: "#9fd6b5",
	sun: "#f3cf72",
});
