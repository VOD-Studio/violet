import {
	draw,
	fineliner,
	gpen,
	inkpen,
	marker,
	rect,
	type SceneItem,
	styles,
} from "@violetjs/inkline";
import { renderSvg } from "@violetjs/inkline/svg";

// #region readme
const style = styles.natural;
const items: SceneItem[] = [
	{ id: "a", path: rect(20, 20, 100, 80), style: { ...style, pen: fineliner } }, // constant width
	{ id: "b", path: rect(150, 20, 100, 80), style: { ...style, pen: inkpen } }, // tapers at both ends
	{ id: "c", path: rect(280, 20, 100, 80), style: { ...style, pen: marker } }, // translucent chisel nib
	{ id: "d", path: rect(410, 20, 100, 80), style: { ...style, pen: gpen } }, // hairline to bold
];
// #endregion

export const scene = { width: 530, height: 120, items };
export const options = { style, seed: 7 };
export const palette = { paper: "#fffdf7", ink: "#2f2b3a" };
export const svg = renderSvg(draw(scene, options), palette);
