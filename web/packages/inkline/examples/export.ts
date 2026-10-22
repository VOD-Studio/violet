import { createSchedule, draw, fills, rect, styles } from "@violetjs/inkline";
import { exportGif } from "@violetjs/inkline/export";

/** Call in a browser: renders the draw-on animation offline and resolves with a GIF. */
export async function exportCard(): Promise<Blob> {
	const drawing = draw(
		{
			width: 240,
			height: 150,
			items: [{ id: "card", path: rect(20, 20, 200, 110, 12), fillRole: "surface" }],
		},
		{ style: { ...styles.natural, fill: fills.hachure }, seed: 35 },
	);
	const palette = { paper: "#fffdf7", ink: "#252332", surface: "#8f7ad1" };
	const schedule = createSchedule(drawing, { mode: "stagger" });
	return exportGif(drawing, palette, { schedule, width: 360, hold: 1.5 });
}
