// #region readme
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

const palette = { paper: "#fffdf7", ink: "#252332", surface: "#8f7ad1" };

// SVG markup as a string. In the browser, mountSvg(drawing, palette) returns an <svg> element.
const svg = renderSvg(drawing, palette);

// #endregion

export { drawing, palette, svg };
