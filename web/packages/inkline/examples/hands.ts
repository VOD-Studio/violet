import { draw, hands, rect, type SceneItem, styles } from "@violetjs/inkline";
import { renderSvg } from "@violetjs/inkline/svg";

// #region readme
const style = styles.natural;
const items: SceneItem[] = [
	{ id: "a", path: rect(20, 20, 100, 80), fillRole: "card", style: styles.neat },
	{ id: "b", path: rect(150, 20, 100, 80), fillRole: "card", style: styles.natural },
	{ id: "c", path: rect(280, 20, 100, 80), fillRole: "card", style: styles.draft }, // every stroke twice
	{
		id: "d",
		path: rect(410, 20, 100, 80),
		fillRole: "card",
		style: { ...style, hand: hands.inking },
	},
];
// #endregion

export const scene = { width: 530, height: 120, items };
export const options = { style, seed: 7 };
export const palette = { paper: "#fffdf7", ink: "#2f2b3a", card: "#e9e1f7" };
export const svg = renderSvg(draw(scene, options), palette);
