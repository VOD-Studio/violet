/**
 * PROTOTYPE（#645）第三轮：四季飘落粒子。
 *
 * 每季运动方式不同：春花瓣斜飘翻转；夏萤火原地游走明灭；秋落叶缓慢打旋下落；冬雪分远近下落。
 * 粒子按远近分层：远景小、慢、淡且虚化。形状先画进离屏精灵，逐帧只做贴图，避免每帧滤镜。
 * 颜色读取探针元素的计算值（canvas 不解析 CSS 变量与 light-dark()）；减弱动态时只画一帧静止画面。
 */
import { useReducedMotion } from "@shared/lib/motion";
import { useEffect, useRef } from "react";

import type { SeasonKey } from "./directions";

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	size: number;
	rotation: number;
	spin: number;
	phase: number;
	sprite: number;
	depth: number;
}

const COUNT: Record<SeasonKey, number> = { spring: 22, summer: 20, autumn: 12, winter: 110 };
const SPRITE = 64;
const BLURS = [0, 1.2, 2.6];

/** 探针：花瓣浅、中、深，萤火，落叶金、琥珀、赭红、灰绿，雪。 */
export const PARTICLE_PROBES = [
	"light-dark(color-mix(in oklch, var(--brand-4) 70%, var(--neutral-1)), color-mix(in oklch, var(--brand-8) 70%, var(--neutral-6)))",
	"light-dark(color-mix(in oklch, var(--brand-6) 85%, var(--neutral-4)), color-mix(in oklch, var(--brand-9) 70%, var(--neutral-7)))",
	"light-dark(color-mix(in oklch, var(--brand-9) 70%, var(--category-6-8)), color-mix(in oklch, var(--brand-10) 75%, var(--category-6-7)))",
	"light-dark(color-mix(in oklch, var(--brand-9) 60%, var(--category-2-8)), color-mix(in oklch, var(--brand-11) 70%, var(--category-2-10)))",
	"color-mix(in oklch, var(--brand-8) 75%, var(--neutral-7))",
	"color-mix(in oklch, var(--category-2-8) 55%, var(--neutral-7))",
	"color-mix(in oklch, var(--category-6-8) 50%, var(--neutral-7))",
	"color-mix(in oklch, var(--category-3-8) 45%, var(--neutral-7))",
	"light-dark(color-mix(in oklch, var(--neutral-6) 70%, var(--brand-5)), var(--neutral-12))",
];

/** 给计算出的颜色加透明度；canvas 不一定认 color-mix()。 */
function withAlpha(color: string, alpha: number) {
	const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
	if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
	return color.replace(/\)$/, ` / ${alpha})`).replace(/ \/ [\d.]+ \/ /, " / ");
}

function canvasOf(size: number) {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	return canvas;
}

/** 在 SPRITE×SPRITE 的画布中心画形状，形状半径约为 SPRITE 的 0.3。 */
function sprite(draw: (context: CanvasRenderingContext2D, r: number) => void, blur: number) {
	const canvas = canvasOf(SPRITE);
	const context = canvas.getContext("2d");
	if (!context) return canvas;
	context.translate(SPRITE / 2, SPRITE / 2);
	if (blur) context.filter = `blur(${blur}px)`;
	draw(context, SPRITE * 0.3);
	return canvas;
}

function petalShape(context: CanvasRenderingContext2D, r: number) {
	context.beginPath();
	context.moveTo(0, r);
	context.bezierCurveTo(-r * 0.85, r * 0.55, -r * 0.8, -r * 0.7, -r * 0.3, -r * 0.95);
	context.quadraticCurveTo(0, -r * 0.82, 0, -r * 0.82);
	context.quadraticCurveTo(0, -r * 0.82, r * 0.3, -r * 0.95);
	context.bezierCurveTo(r * 0.8, -r * 0.7, r * 0.85, r * 0.55, 0, r);
	context.closePath();
}

function mapleShape(context: CanvasRenderingContext2D, r: number) {
	const lobes = [
		[0, -1],
		[0.16, -0.5],
		[0.6, -0.74],
		[0.42, -0.26],
		[0.96, -0.08],
		[0.42, 0.16],
		[0.56, 0.6],
		[0.1, 0.36],
		[0, 0.62],
	];
	context.beginPath();
	context.moveTo(0, -r);
	for (const [x, y] of lobes) context.lineTo(x * r, y * r);
	for (const [x, y] of [...lobes].reverse()) context.lineTo(-x * r, y * r);
	context.closePath();
}

function buildSprites(season: SeasonKey, colors: string[]): HTMLCanvasElement[] {
	const sprites: HTMLCanvasElement[] = [];
	for (const blur of BLURS) {
		switch (season) {
			case "spring":
				for (const [edge, mid, core] of [
					[0, 1, 2],
					[0, 0, 1],
					[1, 1, 2],
				]) {
					sprites.push(
						sprite((context, r) => {
							const gradient = context.createRadialGradient(
								0,
								r,
								0,
								0,
								r * 0.2,
								r * 1.6,
							);
							gradient.addColorStop(0, colors[core]);
							gradient.addColorStop(0.35, colors[mid]);
							gradient.addColorStop(1, colors[edge]);
							context.fillStyle = gradient;
							petalShape(context, r);
							context.fill();
						}, blur),
					);
				}
				break;
			case "summer":
				sprites.push(
					sprite((context, r) => {
						const glow = context.createRadialGradient(0, 0, 0, 0, 0, r * 1.5);
						glow.addColorStop(0, colors[3]);
						glow.addColorStop(0.12, colors[3]);
						glow.addColorStop(0.3, withAlpha(colors[3], 0.35));
						glow.addColorStop(1, withAlpha(colors[3], 0));
						context.fillStyle = glow;
						context.beginPath();
						context.arc(0, 0, r * 1.5, 0, Math.PI * 2);
						context.fill();
					}, blur),
				);
				break;
			case "autumn":
				for (const tone of [4, 5, 6, 7]) {
					sprites.push(
						sprite((context, r) => {
							context.fillStyle = colors[tone];
							mapleShape(context, r);
							context.fill();
							// 叶柄一侧压暗，叶尖一侧提亮
							const shade = context.createLinearGradient(0, r, 0, -r);
							shade.addColorStop(0, "rgba(0, 0, 0, 0.22)");
							shade.addColorStop(1, "rgba(255, 255, 255, 0.12)");
							context.globalCompositeOperation = "source-atop";
							context.fillStyle = shade;
							context.fillRect(-r, -r, r * 2, r * 2);
							context.globalCompositeOperation = "source-over";
							context.strokeStyle = "rgba(255, 255, 255, 0.5)";
							context.globalAlpha = 0.45;
							context.lineWidth = 1;
							context.beginPath();
							context.moveTo(0, r * 0.62);
							context.lineTo(0, -r * 0.8);
							context.moveTo(0, r * 0.1);
							context.lineTo(r * 0.62, -r * 0.5);
							context.moveTo(0, r * 0.1);
							context.lineTo(-r * 0.62, -r * 0.5);
							context.stroke();
						}, blur),
					);
				}
				break;
			default:
				sprites.push(
					sprite((context, r) => {
						const flake = context.createRadialGradient(0, 0, 0, 0, 0, r);
						flake.addColorStop(0, colors[8]);
						flake.addColorStop(0.55, withAlpha(colors[8], 0.75));
						flake.addColorStop(1, withAlpha(colors[8], 0));
						context.fillStyle = flake;
						context.beginPath();
						context.arc(0, 0, r, 0, Math.PI * 2);
						context.fill();
					}, blur),
				);
		}
	}
	return sprites;
}

export function useSeasonParticles(season: SeasonKey | null) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const probeRef = useRef<HTMLSpanElement>(null);
	const reduceMotion = useReducedMotion();

	useEffect(() => {
		const canvas = canvasRef.current;
		const probe = probeRef.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !probe || !context || !season) return undefined;

		let width = 0;
		let height = 0;
		let sprites: HTMLCanvasElement[] = [];
		const perBlur = { spring: 3, summer: 1, autumn: 4, winter: 1 }[season];
		const readColors = () => {
			const colors = Array.from(probe.children).map((child) => getComputedStyle(child).color);
			sprites = buildSprites(season, colors);
		};
		const fitCanvas = () => {
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			width = canvas.clientWidth;
			height = canvas.clientHeight;
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		const spawn = (initial: boolean): Particle => {
			const depth = Math.random();
			// 远景（depth 小）更小、更慢、更虚
			const near = 0.45 + depth * 0.55;
			const layer = depth < 0.3 ? 2 : depth < 0.6 ? 1 : 0;
			const base: Particle = {
				x: Math.random() * width,
				y: initial ? Math.random() * height : -30,
				vx: 0,
				vy: 0,
				size: 0,
				rotation: Math.random() * Math.PI * 2,
				spin: 0,
				phase: Math.random() * Math.PI * 2,
				sprite: layer * perBlur + Math.floor(Math.random() * perBlur),
				depth,
			};
			switch (season) {
				case "spring":
					return {
						...base,
						x: initial ? base.x : width * (0.25 + Math.random() * 0.85),
						vx: (-12 - Math.random() * 14) * near,
						vy: (16 + Math.random() * 14) * near,
						size: (9 + Math.random() * 5) * near,
						spin: (Math.random() - 0.5) * 2.2,
					};
				case "summer":
					return {
						...base,
						y: height * (0.35 + Math.random() * 0.65),
						vx: (Math.random() - 0.5) * 8,
						vy: (Math.random() - 0.5) * 8,
						size: (10 + Math.random() * 6) * near,
					};
				case "autumn":
					return {
						...base,
						vx: (-6 + Math.random() * 12) * near,
						vy: (20 + Math.random() * 14) * near,
						size: (16 + Math.random() * 10) * near,
						spin: (Math.random() - 0.5) * 1.4,
					};
				default:
					return {
						...base,
						vx: (-5 + Math.random() * 4) * near,
						vy: (12 + depth * 36) * near,
						size: 3 + depth * 7,
					};
			}
		};

		let particles: Particle[] = [];
		let frame = 0;
		let last = performance.now();

		const draw = (now: number) => {
			context.clearRect(0, 0, width, height);
			for (const p of particles) {
				const image = sprites[p.sprite];
				if (!image) continue;
				context.globalAlpha =
					season === "summer"
						? (0.15 + 0.85 * Math.max(0, Math.sin(now / 950 + p.phase)) ** 3) *
							(0.5 + p.depth * 0.5)
						: 0.35 + p.depth * 0.55;
				context.save();
				context.translate(p.x, p.y);
				context.rotate(p.rotation);
				const drawn = (p.size / (SPRITE * 0.3)) * SPRITE;
				context.drawImage(image, -drawn / 2, -drawn / 2, drawn, drawn);
				context.restore();
			}
			context.globalAlpha = 1;
		};

		const step = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			for (let i = 0; i < particles.length; i++) {
				const p = particles[i];
				if (season === "summer") {
					p.vx += (Math.random() - 0.5) * 16 * dt;
					p.vy += (Math.random() - 0.5) * 16 * dt;
					const speed = Math.hypot(p.vx, p.vy);
					if (speed > 9) {
						p.vx = (p.vx / speed) * 9;
						p.vy = (p.vy / speed) * 9;
					}
					p.x += p.vx * dt;
					p.y += p.vy * dt;
					if (p.x < -20 || p.x > width + 20 || p.y < height * 0.25 || p.y > height + 20)
						particles[i] = spawn(true);
					continue;
				}
				const swayAmplitude = season === "autumn" ? 28 : season === "spring" ? 16 : 7;
				const sway =
					Math.sin(now / 1100 + p.phase) * swayAmplitude * (0.45 + p.depth * 0.55);
				p.x += (p.vx + sway) * dt;
				p.y += p.vy * dt;
				p.rotation += p.spin * dt;
				if (p.y > height + 30 || p.x < -50 || p.x > width + 50) particles[i] = spawn(false);
			}
			draw(now);
			frame = requestAnimationFrame(step);
		};

		fitCanvas();
		readColors();
		particles = Array.from({ length: COUNT[season] }, () => spawn(true));

		const observer = new MutationObserver(() => {
			readColors();
			if (reduceMotion) draw(0);
		});
		observer.observe(document.documentElement, { attributes: true });
		const onResize = () => {
			fitCanvas();
			if (reduceMotion) draw(0);
		};
		window.addEventListener("resize", onResize);

		if (reduceMotion) {
			draw(0);
		} else {
			frame = requestAnimationFrame((now) => {
				last = now;
				step(now);
			});
		}
		const onVisibility = () => {
			cancelAnimationFrame(frame);
			if (!document.hidden && !reduceMotion) {
				last = performance.now();
				frame = requestAnimationFrame(step);
			}
		};
		document.addEventListener("visibilitychange", onVisibility);

		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			window.removeEventListener("resize", onResize);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [season, reduceMotion]);

	return { canvasRef, probeRef };
}
