import type { WindowPhotoSlot } from "../model/types";

/** 可复现的伪随机数：同一槽位每次画出同样的景。 */
export function seeded(seed: number): () => number {
	let x = seed >>> 0;
	return () => {
		x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
		return x / 4294967296;
	};
}

interface Palette {
	sky: [string, string, string];
	land: [string, string];
	shapes: string;
	lights: string[];
	lightCount: number;
}

const PALETTES: Record<WindowPhotoSlot, Palette> = {
	clear: {
		sky: ["#8fb8e0", "#cfe0ef", "#f2e2c9"],
		land: ["#b9c4a3", "#9fae8a"],
		shapes: "#7f8f73",
		lights: [],
		lightCount: 0,
	},
	cloudy: {
		sky: ["#9aa5b1", "#c3c9cf", "#d9dcdc"],
		land: ["#a8ae9f", "#8f9688"],
		shapes: "#737a70",
		lights: [],
		lightCount: 0,
	},
	rain: {
		sky: ["#6f7b88", "#9aa4ad", "#b6bcbf"],
		land: ["#7e8578", "#666d63"],
		shapes: "#4d544d",
		lights: ["#ffd9a0", "#ffe7c2"],
		lightCount: 18,
	},
	snow: {
		sky: ["#c7d0da", "#e1e6ec", "#eef1f4"],
		land: ["#f4f6f8", "#e6eaee"],
		shapes: "#6d737a",
		lights: ["#ffe2b8"],
		lightCount: 6,
	},
	night: {
		sky: ["#0f1626", "#1b2540", "#2d3655"],
		land: ["#151a24", "#0d1118"],
		shapes: "#0a0d13",
		lights: ["#ffd9a0", "#ffc27a", "#bcd4ff", "#ffe7c2"],
		lightCount: 90,
	},
};

/** 浅色主题下的夜：蓝调时刻的天色，擦开雾时不会在亮的界面上露出大块深色 */
const BLUE_HOUR: Palette = {
	sky: ["#56688c", "#8492b0", "#b8b4c4"],
	land: ["#6e7486", "#5a6072"],
	shapes: "#454b5c",
	lights: ["#ffd9a0", "#ffc27a", "#ffe7c2"],
	lightCount: 60,
};

/**
 * 画内置的默认窗外景：天色、远处的屋顶与树、灯。画面会被 CSS 大幅虚化，只需要色块与光点。
 *
 * @param ctx - 已按目标尺寸缩放的 2D 上下文
 * @param width - 绘制宽度（CSS 像素）
 * @param height - 绘制高度（CSS 像素）
 * @param dark - 深色主题；浅色主题下的夜改画蓝调时刻
 */
export function drawDefaultScene(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	slot: WindowPhotoSlot,
	dark: boolean,
) {
	const p = slot === "night" && !dark ? BLUE_HOUR : PALETTES[slot];
	const rnd = seeded(slot.length * 7919 + 17);
	const horizon = height * 0.62;

	const sky = ctx.createLinearGradient(0, 0, 0, horizon);
	sky.addColorStop(0, p.sky[0]);
	sky.addColorStop(0.6, p.sky[1]);
	sky.addColorStop(1, p.sky[2]);
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, width, horizon);

	if (slot === "clear") {
		const sun = ctx.createRadialGradient(
			width * 0.82,
			height * 0.16,
			0,
			width * 0.82,
			height * 0.16,
			width * 0.32,
		);
		sun.addColorStop(0, "rgba(255,240,210,.85)");
		sun.addColorStop(1, "rgba(255,240,210,0)");
		ctx.fillStyle = sun;
		ctx.fillRect(0, 0, width, horizon);
	}
	if (slot === "cloudy" || slot === "rain") {
		for (let i = 0; i < 9; i++) {
			ctx.fillStyle = `rgba(255,255,255,${0.12 + rnd() * 0.18})`;
			ctx.beginPath();
			ctx.ellipse(
				rnd() * width,
				rnd() * horizon * 0.7,
				width * (0.12 + rnd() * 0.18),
				height * (0.05 + rnd() * 0.06),
				0,
				0,
				Math.PI * 2,
			);
			ctx.fill();
		}
	}

	const land = ctx.createLinearGradient(0, horizon, 0, height);
	land.addColorStop(0, p.land[0]);
	land.addColorStop(1, p.land[1]);
	ctx.fillStyle = land;
	ctx.fillRect(0, horizon, width, height - horizon);

	// 远处的屋顶与树冠：沿地平线排开，高矮不一
	ctx.fillStyle = p.shapes;
	let x = -20;
	while (x < width + 20) {
		const w = 30 + rnd() * 90;
		const h = 20 + rnd() * rnd() * height * 0.22;
		if (rnd() < 0.55) ctx.fillRect(x, horizon - h, w, h + 4);
		else {
			ctx.beginPath();
			ctx.ellipse(x + w / 2, horizon - h * 0.4, w * 0.6, h * 0.8, 0, 0, Math.PI * 2);
			ctx.fill();
		}
		x += w * (0.6 + rnd() * 0.6);
	}

	for (let i = 0; i < p.lightCount; i++) {
		const lx = rnd() * width;
		const ly = horizon - rnd() * height * 0.2 + rnd() * height * 0.06;
		const r = 1.5 + rnd() * rnd() * 7;
		const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 3);
		const c = p.lights[Math.floor(rnd() * p.lights.length)];
		g.addColorStop(0, c);
		g.addColorStop(1, `${c}00`);
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(lx, ly, r * 3, 0, Math.PI * 2);
		ctx.fill();
	}
}
