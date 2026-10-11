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

export const svg = renderSvg(draw({ width: 530, height: 120, items }, { style, seed: 7 }), {
	paper: "#fffdf7",
	ink: "#2f2b3a",
	card: "#e9e1f7",
});
