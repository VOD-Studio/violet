import { draw, fills, rect, styles } from "@violetjs/inkline";
import { renderSvg } from "@violetjs/inkline/svg";

const drawing = draw(
	{
		width: 240,
		height: 150,
		items: [{ id: "card", path: rect(20, 20, 200, 110, 12), fillRole: "surface" }],
	},
	{ style: { ...styles.natural, fill: fills.hachure }, seed: 35 },
);

// renderSvg returns SVG markup; in the browser, mountSvg returns an <svg> element instead.
export const svg = renderSvg(drawing, { paper: "#fffdf7", ink: "#252332", surface: "#8f7ad1" });
