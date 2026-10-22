import {
	circle,
	draw,
	lineWashStyle,
	pathFromSvg,
	polygon,
	rect,
	type SceneItem,
} from "@violetjs/inkline";
import { renderSvg } from "@violetjs/inkline/svg";

// #region readme
const style = lineWashStyle;
const items: SceneItem[] = [
	{ id: "hill", path: pathFromSvg("M0 230C120 180 260 190 400 236V280H0Z"), fillRole: "grass" },
	{ id: "sun", path: circle(330, 70, 34), fillRole: "sun" },
	{ id: "wall", path: rect(110, 140, 140, 96), fillRole: "wall" },
	{
		id: "roof",
		path: polygon([
			[94, 146],
			[180, 80],
			[266, 146],
		]),
		fillRole: "roof",
	},
	{ id: "door", path: rect(134, 176, 36, 60, 4), fillRole: "door" },
	{ id: "window", path: rect(192, 168, 38, 34), fillRole: "glass" },
];
// #endregion

export const scene = { width: 400, height: 280, items };
export const options = { style, seed: 7, width: 2.4 };
export const palette = {
	paper: "#fffdf7",
	ink: "#4a3431",
	grass: "#cfe6b8",
	sun: "#f7dd8a",
	wall: "#f4e3cf",
	roof: "#e8a28f",
	door: "#b9d3e8",
	glass: "#d9ecf6",
};
export const svg = renderSvg(draw(scene, options), palette);
