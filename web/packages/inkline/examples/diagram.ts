import { draw, fills, gpen, line, polygon, rect, type SceneItem, styles } from "@violetjs/inkline";
import { renderSvg } from "@violetjs/inkline/svg";

// #region readme
const style = { ...styles.draft, pen: gpen };
const items: SceneItem[] = [
	{
		id: "draft",
		path: rect(20, 30, 120, 50, 8),
		fillRole: "sky",
		label: { text: "Draft", x: 80, y: 55 },
	},
	{
		id: "review",
		path: polygon([
			[270, 10],
			[340, 55],
			[270, 100],
			[200, 55],
		]),
		fillRole: "lilac",
		label: { text: "Review?", x: 270, y: 55 },
	},
	{ id: "edge", path: line(140, 55, 200, 55), pinEnds: true }, // ends stay on the node edges
	{
		id: "head",
		path: polygon([
			[200, 55],
			[189, 50],
			[189, 60],
		]),
		fillRole: "ink",
		strokeRole: "none",
		style: { ...style, fill: fills.solid },
	},
];
// #endregion

export const svg = renderSvg(
	draw({ width: 360, height: 110, items }, { style, seed: 7, width: 1.6 }),
	{
		paper: "#fffdf7",
		ink: "#3b3646",
		sky: "#bfe0ec",
		lilac: "#d9cdf0",
	},
);
