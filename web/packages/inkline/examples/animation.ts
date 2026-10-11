import { createPlayer, createSchedule, draw, rect, styles } from "@violetjs/inkline";
import { mountSvg, seekSvg } from "@violetjs/inkline/svg";

/** Call in a browser; cancel the returned player when removing the host. */
export function animateCard(host: HTMLElement) {
	const drawing = draw(
		{ width: 240, height: 150, items: [{ id: "card", path: rect(20, 20, 200, 110, 12) }] },
		{ style: styles.natural, seed: 35 },
	);
	const palette = { paper: "#fffdf7", ink: "#252332" };
	const schedule = createSchedule(drawing, { mode: "stagger" });
	const svg = mountSvg(drawing, palette, { schedule });
	host.append(svg);
	const player = createPlayer({
		duration: schedule.duration,
		onFrame: (time) => seekSvg(svg, time),
	});
	player.play();
	return player;
}
