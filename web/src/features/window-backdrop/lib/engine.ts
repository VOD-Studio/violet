import { cssColorToHex } from "@shared/lib/css-vars";
import type { WindowCondition, WindowPhotoSlot } from "../model/types";
import { drawDefaultScene, seeded } from "./scene";

/** 窗的四层画布，自下而上：窗外的景、窗外的东西（落雪、光、闪电）、雾、玻璃上的水珠 */
export interface WindowLayers {
	view: HTMLCanvasElement;
	out: HTMLCanvasElement;
	fog: HTMLCanvasElement;
	glass: HTMLCanvasElement;
}

/** 窗此刻要画成的样子 */
export interface WindowScene {
	condition: WindowCondition;
	slot: WindowPhotoSlot;
	isDay: boolean;
	dark: boolean;
	/** 阅读页：雾更浓，水珠只出现在正文栏两侧 */
	dense: boolean;
	/** 减弱动态：只画结果，不动 */
	still: boolean;
	/** 已加载的自定义窗外照片；null 时画内置默认景 */
	photo: HTMLImageElement | null;
}

/** 窗引擎：画、擦雾、敲窗，空闲时自动停帧 */
export interface WindowEngine {
	setScene(scene: WindowScene): void;
	resize(): void;
	/** 擦掉一段雾（CSS 像素坐标，从上一点到当前点） */
	wipe(fromX: number, fromY: number, toX: number, toY: number): void;
	/** 敲窗：水珠被震下来，粘着的雪掉落，光里的灰扬起来 */
	knock(): void;
	setPaused(paused: boolean): void;
	destroy(): void;
}

type RGB = [number, number, number];

interface Drop {
	x: number;
	y: number;
	r: number;
	vy: number;
	sliding: boolean;
	phase: number;
}
interface Flake {
	x: number;
	y: number;
	r: number;
	v: number;
	phase: number;
}
interface Stuck {
	x: number;
	y: number;
	r: number;
	a: number;
	t: number;
	falling: boolean;
}
interface Mote {
	x: number;
	y: number;
	r: number;
	vx: number;
	vy: number;
	phase: number;
}

/** 视图与雾按半分辨率绘制：它们本就柔和，省下四分之三的像素 */
const SOFT_SCALE = 0.5;
/** 30 帧足够表现水珠下滑，全屏画布按 60 帧画太耗电 */
const FRAME_MS = 1000 / 30;
/** 阅读页正文栏的最大宽度（与文章正文一致），水珠避开这一栏 */
const COLUMN = 760;

function hexToRgb(hex: string | null, fallback: RGB): RGB {
	if (!hex) return fallback;
	return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as RGB;
}

function rgba(c: RGB, a: number) {
	return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function fitCanvas(cv: HTMLCanvasElement, width: number, height: number, scale: number) {
	cv.width = Math.max(1, Math.round(width * scale));
	cv.height = Math.max(1, Math.round(height * scale));
	const g = cv.getContext("2d");
	if (!g) throw new Error("canvas 2d 不可用");
	g.setTransform(scale, 0, 0, scale, 0, 0);
	return g;
}

const NOOP_ENGINE: WindowEngine = {
	setScene() {},
	resize() {},
	wipe() {},
	knock() {},
	setPaused() {},
	destroy() {},
};

/**
 * 创建窗引擎并接管四层画布。
 *
 * @param layers - 自下而上的四层画布，尺寸铺满视口
 * @returns 引擎句柄；组件卸载时调用 destroy。环境不支持 2D 画布（如 jsdom）时返回什么都不做的句柄
 */
export function createWindowEngine(layers: WindowLayers): WindowEngine {
	if (!layers.glass.getContext("2d")) return NOOP_ENGINE;
	let scene: WindowScene | null = null;
	let W = 0;
	let H = 0;
	let glassScale = 1;
	let gView: CanvasRenderingContext2D | null = null;
	let gOut: CanvasRenderingContext2D | null = null;
	let gFog: CanvasRenderingContext2D | null = null;
	let gGlass: CanvasRenderingContext2D | null = null;
	const mask = document.createElement("canvas");
	const beads = document.createElement("canvas");
	let gMask: CanvasRenderingContext2D | null = null;
	let gBeads: CanvasRenderingContext2D | null = null;
	let fogColor: RGB = [246, 244, 241];
	let drops: Drop[] = [];
	let flakes: Flake[] = [];
	let stuck: Stuck[] = [];
	let motes: Mote[] = [];
	let maskUntil = 0;
	let flashAt = 0;
	let nextFlash = 0;
	let raf = 0;
	let last = 0;
	let paused = false;

	const rainy = () => scene?.condition === "rain" || scene?.condition === "storm";
	const snowy = () => scene?.condition === "snow";
	const sunny = () => scene?.condition === "clear" && scene.isDay;
	const fogAlpha = () => {
		if (!scene) return 0.8;
		const base = scene.condition === "clear" ? 0.62 : scene.condition === "fog" ? 0.9 : 0.8;
		return Math.min(0.94, base + (scene.dense ? 0.1 : 0) - (scene.dark ? 0.06 : 0));
	};
	/** 阅读页里水珠只能落在正文栏两侧 */
	const inMargin = (x: number) => {
		if (!scene?.dense) return true;
		const col = Math.min(COLUMN, W - 32);
		return x < (W - col) / 2 - 24 || x > (W + col) / 2 + 24;
	};
	const marginX = (rnd: () => number) => {
		if (!scene?.dense) return rnd() * W;
		const col = Math.min(COLUMN, W - 32);
		const side = (W - col) / 2 - 24;
		if (side < 40) return -100;
		return rnd() < 0.5 ? rnd() * side : W - rnd() * side;
	};

	const bead = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
		const dk = scene?.dark;
		g.fillStyle = dk ? "rgba(0,0,0,.35)" : "rgba(60,64,72,.16)";
		g.beginPath();
		g.arc(x, y + r * 0.25, r, 0, Math.PI * 2);
		g.fill();
		g.fillStyle = dk ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.85)";
		g.beginPath();
		g.arc(x - r * 0.25, y - r * 0.3, r * 0.45, 0, Math.PI * 2);
		g.fill();
	};

	const drawView = () => {
		if (!gView || !scene) return;
		gView.clearRect(0, 0, W, H);
		const img = scene.photo;
		if (img?.naturalWidth) {
			const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
			const w = img.naturalWidth * s;
			const h = img.naturalHeight * s;
			gView.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
		} else {
			drawDefaultScene(gView, W, H, scene.slot, scene.dark);
		}
	};

	const seed = () => {
		const rnd = seeded(17);
		drops = [];
		flakes = [];
		stuck = [];
		motes = [];
		gMask = fitCanvas(mask, W, H, SOFT_SCALE);
		gBeads = fitCanvas(beads, W, H, glassScale);
		const area = (W * H) / (1440 * 900);
		if (rainy()) {
			for (let i = 0; i < 1400 * area; i++) {
				const x = marginX(rnd);
				if (x >= 0) bead(gBeads, x, rnd() * H, 0.4 + rnd() * rnd() * 1.6);
			}
			for (let i = 0; i < 30 * area; i++) {
				const x = marginX(rnd);
				if (x >= 0)
					drops.push({
						x,
						y: rnd() * H,
						r: 2.4 + rnd() * 4,
						vy: 0,
						sliding: false,
						phase: rnd() * 6,
					});
			}
		}
		if (snowy()) {
			for (let i = 0; i < 160 * area; i++)
				flakes.push({
					x: rnd() * W,
					y: rnd() * H,
					r: 0.8 + rnd() * 2.4,
					v: 10 + rnd() * 22,
					phase: rnd() * 6,
				});
			for (let i = 0; i < 18 * area; i++) {
				const x = marginX(rnd);
				if (x >= 0)
					stuck.push({
						x,
						y: rnd() * H,
						r: 1.6 + rnd() * 2.6,
						a: 1,
						t: rnd() * 6,
						falling: false,
					});
			}
		}
		if (sunny())
			for (let i = 0; i < 100 * area; i++)
				motes.push({
					x: rnd() * W,
					y: rnd() * H,
					r: 0.5 + rnd() * 1.3,
					vx: 0,
					vy: 0,
					phase: rnd() * 6,
				});
	};

	const composeFog = () => {
		if (!gFog) return;
		gFog.globalCompositeOperation = "source-over";
		gFog.clearRect(0, 0, W, H);
		gFog.fillStyle = rgba(fogColor, fogAlpha());
		gFog.fillRect(0, 0, W, H);
		gFog.globalCompositeOperation = "destination-out";
		gFog.drawImage(mask, 0, 0, W, H);
		gFog.globalCompositeOperation = "source-over";
	};

	const clearAt = (x: number, y: number, radius: number, a: number) => {
		if (!gMask) return;
		const gr = gMask.createRadialGradient(x, y, 0, x, y, radius);
		gr.addColorStop(0, `rgba(0,0,0,${a})`);
		gr.addColorStop(0.7, `rgba(0,0,0,${a * 0.7})`);
		gr.addColorStop(1, "rgba(0,0,0,0)");
		gMask.fillStyle = gr;
		gMask.beginPath();
		gMask.arc(x, y, radius, 0, Math.PI * 2);
		gMask.fill();
		maskUntil = performance.now() + 7000;
	};

	const eraseBeads = (x: number, y: number, radius: number) => {
		if (!gBeads) return;
		gBeads.globalCompositeOperation = "destination-out";
		gBeads.fillStyle = "rgba(0,0,0,1)";
		gBeads.beginPath();
		gBeads.arc(x, y, radius, 0, Math.PI * 2);
		gBeads.fill();
		gBeads.globalCompositeOperation = "source-over";
	};

	/** 水珠是一面小透镜：里面是窗外上下颠倒、更清楚的景 */
	const drawDrop = (d: Drop) => {
		const g = gGlass;
		if (!g || !scene) return;
		const vs = layers.view.width / W;
		const span = d.r * 7;
		g.save();
		g.beginPath();
		g.ellipse(d.x, d.y, d.r * 0.94, d.r, 0, 0, Math.PI * 2);
		g.clip();
		g.translate(d.x, d.y);
		g.scale(1, -1);
		g.globalAlpha = scene.dark ? 0.55 : 1;
		g.drawImage(
			layers.view,
			(d.x - span / 2) * vs,
			(d.y - span / 2) * vs,
			span * vs,
			span * vs,
			-d.r,
			-d.r,
			d.r * 2,
			d.r * 2,
		);
		// 折射取的是未经 CSS 调色的原景，叠一层雾色，水珠才和雾后的景一样柔和
		g.globalAlpha = 1;
		g.fillStyle = rgba(fogColor, scene.dark ? 0.3 : 0.42);
		g.fillRect(-d.r, -d.r, d.r * 2, d.r * 2);
		g.restore();
		g.strokeStyle = scene.dark ? "rgba(0,0,0,.45)" : "rgba(40,44,52,.2)";
		g.lineWidth = 0.9;
		g.beginPath();
		g.ellipse(d.x, d.y, d.r * 0.94, d.r, 0, 0.2, 2.94);
		g.stroke();
		g.fillStyle = scene.dark ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.95)";
		g.beginPath();
		g.ellipse(d.x - d.r * 0.32, d.y - d.r * 0.42, d.r * 0.2, d.r * 0.14, -0.6, 0, Math.PI * 2);
		g.fill();
	};

	const drawStuck = (s: Stuck) => {
		const g = gGlass;
		if (!g || !scene) return;
		g.globalAlpha = Math.max(0, s.a);
		g.fillStyle = scene.dark ? "rgba(236,240,248,.85)" : "rgba(255,255,255,.98)";
		g.strokeStyle = g.fillStyle;
		g.shadowColor = scene.dark ? "rgba(0,0,0,.5)" : "rgba(70,80,100,.25)";
		g.shadowBlur = 3;
		g.lineWidth = 0.8;
		g.beginPath();
		for (let k = 0; k < 6; k++) {
			const a = k * (Math.PI / 3) + s.t * 0.02;
			g.moveTo(s.x, s.y);
			g.lineTo(s.x + Math.cos(a) * s.r * 1.6, s.y + Math.sin(a) * s.r * 1.6);
		}
		g.stroke();
		g.beginPath();
		g.arc(s.x, s.y, s.r * 0.55, 0, Math.PI * 2);
		g.fill();
		g.shadowColor = "transparent";
		g.globalAlpha = 1;
	};

	/** 画一帧；返回 true 表示还要继续动 */
	const frame = (t: number, dt: number): boolean => {
		if (!scene || !gOut || !gGlass || !gMask) return false;
		const moving = !scene.still && (rainy() || snowy() || sunny());
		const rnd = Math.random;
		if (t < maskUntil) {
			gMask.globalCompositeOperation = "destination-out";
			gMask.fillStyle = `rgba(0,0,0,${scene.still ? 0.012 : 0.02})`;
			gMask.fillRect(0, 0, W, H);
			gMask.globalCompositeOperation = "source-over";
		}
		gOut.clearRect(0, 0, W, H);
		if (snowy()) {
			gOut.fillStyle = "rgba(255,255,255,.9)";
			for (const f of flakes) {
				if (!scene.still) {
					f.y += f.v * dt;
					f.x += Math.sin(t / 900 + f.phase) * 8 * dt;
					if (f.y > H + 4) {
						f.y = -4;
						f.x = rnd() * W;
					}
				}
				gOut.beginPath();
				gOut.arc(f.x, f.y, f.r, 0, Math.PI * 2);
				gOut.fill();
			}
		}
		if (sunny()) {
			const beam = gOut.createLinearGradient(W * 0.9, 0, W * 0.35, H);
			beam.addColorStop(0, scene.dark ? "rgba(255,220,170,.06)" : "rgba(255,226,170,.4)");
			beam.addColorStop(1, "rgba(255,226,170,0)");
			gOut.fillStyle = beam;
			gOut.beginPath();
			gOut.moveTo(W * 0.72, 0);
			gOut.lineTo(W, 0);
			gOut.lineTo(W * 0.62, H);
			gOut.lineTo(W * 0.3, H);
			gOut.closePath();
			gOut.fill();
			gOut.fillStyle = scene.dark ? "rgba(255,236,200,.35)" : "rgba(255,250,236,.95)";
			for (const p of motes) {
				if (!scene.still) {
					p.vx = p.vx * 0.98 + Math.sin(t / 1400 + p.phase) * 0.6;
					p.vy = p.vy * 0.98 + Math.cos(t / 1700 + p.phase) * 0.4 - 0.15;
					p.x += p.vx * dt * 6;
					p.y += p.vy * dt * 6;
					if (p.y < -4) p.y = H + 4;
					if (p.x < -4) p.x = W + 4;
					if (p.x > W + 4) p.x = -4;
				}
				gOut.beginPath();
				gOut.arc(p.x, p.y, p.r, 0, Math.PI * 2);
				gOut.fill();
			}
		}
		if (scene.condition === "storm" && !scene.still) {
			if (!nextFlash) nextFlash = t + 12000 + rnd() * 18000;
			if (t > nextFlash) {
				flashAt = t;
				nextFlash = t + 15000 + rnd() * 25000;
			}
			const k = 1 - (t - flashAt) / 380;
			if (k > 0) {
				gOut.fillStyle = `rgba(255,255,255,${(scene.dark ? 0.12 : 0.3) * k})`;
				gOut.fillRect(0, 0, W, H);
			}
		}
		composeFog();
		gGlass.clearRect(0, 0, W, H);
		if (rainy()) {
			gGlass.drawImage(beads, 0, 0, W, H);
			for (const d of drops) {
				if (!scene.still) {
					if (!d.sliding && d.r > 4.4 && rnd() < 0.004) d.sliding = true;
					if (d.sliding) {
						d.vy += (24 + d.r * 14 - d.vy) * 0.08;
						if (rnd() < 0.02) d.vy *= 0.15;
						const py = d.y;
						d.y += d.vy * dt;
						d.x += Math.sin(d.y * 0.04 + d.phase) * 0.25;
						clearAt(d.x, d.y - d.r, d.r * 1.3, 0.32);
						eraseBeads(d.x, d.y, d.r * 1.2);
						if (gBeads && Math.floor(py / 14) !== Math.floor(d.y / 14) && rnd() < 0.7)
							bead(
								gBeads,
								d.x + (rnd() - 0.5) * 2,
								d.y - d.r * 2.2,
								0.6 + rnd() * 1.1,
							);
						d.r = Math.min(7.5, d.r + dt * 0.25);
						if (d.y > H + 12) {
							d.y = -10 - rnd() * 40;
							d.x = marginX(rnd);
							d.r = 2.4 + rnd() * 3.4;
							d.sliding = false;
							d.vy = 0;
						}
					}
				}
				if (d.x >= 0 && inMargin(d.x)) drawDrop(d);
			}
		}
		if (snowy()) {
			for (const s of stuck) {
				s.t += dt;
				if (s.falling && !scene.still) {
					s.y += 90 * dt;
					s.a -= dt * 0.6;
				}
				drawStuck(s);
			}
			stuck = stuck.filter((s) => s.a > 0);
			if (!scene.still && stuck.length < 14 && rnd() < 0.01) {
				const x = marginX(rnd);
				if (x >= 0)
					stuck.push({
						x,
						y: rnd() * H * 0.9,
						r: 1.6 + rnd() * 2.6,
						a: 1,
						t: 0,
						falling: false,
					});
			}
		}
		return moving || t < maskUntil;
	};

	const run = (t: number) => {
		raf = 0;
		if (paused) return;
		if (last && t - last < FRAME_MS) {
			raf = requestAnimationFrame(run);
			return;
		}
		const dt = Math.min(0.1, last ? (t - last) / 1000 : 0.033);
		last = t;
		if (frame(t, dt)) raf = requestAnimationFrame(run);
		else last = 0;
	};
	const kick = () => {
		if (!raf && !paused) raf = requestAnimationFrame(run);
	};

	const rebuild = () => {
		W = window.innerWidth;
		H = window.innerHeight;
		glassScale = Math.min(1.5, window.devicePixelRatio || 1);
		gView = fitCanvas(layers.view, W, H, SOFT_SCALE);
		gOut = fitCanvas(layers.out, W, H, SOFT_SCALE);
		gFog = fitCanvas(layers.fog, W, H, SOFT_SCALE);
		gGlass = fitCanvas(layers.glass, W, H, glassScale);
		drawView();
		seed();
		last = 0;
		frame(performance.now(), 0);
		kick();
	};

	return {
		setScene(next) {
			const prev = scene;
			scene = next;
			fogColor = hexToRgb(
				cssColorToHex(
					getComputedStyle(document.documentElement).getPropertyValue(
						"--color-background",
					),
				),
				next.dark ? [24, 23, 22] : [246, 244, 241],
			);
			const reseed =
				!prev ||
				!W ||
				prev.condition !== next.condition ||
				prev.isDay !== next.isDay ||
				prev.dense !== next.dense ||
				prev.dark !== next.dark;
			if (!W) {
				rebuild();
				return;
			}
			if (
				!prev ||
				prev.photo !== next.photo ||
				prev.slot !== next.slot ||
				prev.dark !== next.dark
			)
				drawView();
			if (reseed) seed();
			frame(performance.now(), 0);
			kick();
		},
		resize: rebuild,
		wipe(fromX, fromY, toX, toY) {
			const n = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toY - fromY) / 6));
			for (let i = 1; i <= n; i++) {
				const x = fromX + ((toX - fromX) * i) / n;
				const y = fromY + ((toY - fromY) * i) / n;
				clearAt(x, y, 34, 0.85);
				eraseBeads(x, y, 22);
			}
			kick();
		},
		knock() {
			for (const d of drops) if (d.r > 3 && Math.random() < 0.7) d.sliding = true;
			for (const s of stuck) if (Math.random() < 0.8) s.falling = true;
			for (const p of motes) {
				p.vx += (Math.random() - 0.5) * 30;
				p.vy += (Math.random() - 0.5) * 30;
			}
			kick();
		},
		setPaused(next) {
			paused = next;
			if (paused && raf) {
				cancelAnimationFrame(raf);
				raf = 0;
			}
			last = 0;
			if (!paused) kick();
		},
		destroy() {
			paused = true;
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
		},
	};
}
