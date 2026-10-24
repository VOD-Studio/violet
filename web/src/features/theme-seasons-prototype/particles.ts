/**
 * PROTOTYPE（#645）：四季飘落粒子。每季运动方式不同：
 * 春花瓣斜飘翻转；夏萤火原地游走明灭；秋落叶缓慢打旋下落；冬雪分远近三层下落。
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
	tone: number;
	depth: number;
}

const COUNT: Record<SeasonKey, number> = { spring: 16, summer: 22, autumn: 9, winter: 90 };

function petal(context: CanvasRenderingContext2D, size: number) {
	context.beginPath();
	context.moveTo(0, -size);
	context.bezierCurveTo(size * 0.75, -size * 0.7, size * 0.55, size * 0.6, 0, size);
	context.bezierCurveTo(-size * 0.55, size * 0.6, -size * 0.75, -size * 0.7, 0, -size);
	context.fill();
}

function mapleLeaf(context: CanvasRenderingContext2D, size: number) {
	// 五裂枫叶：外凸点与内凹点交替，叶柄朝下
	const lobes = [
		[0, -1],
		[0.18, -0.52],
		[0.62, -0.72],
		[0.42, -0.24],
		[0.95, -0.05],
		[0.4, 0.18],
		[0.52, 0.62],
		[0.08, 0.36],
		[0, 0.9],
	];
	context.beginPath();
	context.moveTo(0, -size);
	for (const [x, y] of lobes) context.lineTo(x * size, y * size);
	for (const [x, y] of [...lobes].reverse()) context.lineTo(-x * size, y * size);
	context.closePath();
	context.fill();
	context.lineWidth = 0.8;
	context.beginPath();
	context.moveTo(0, size * 0.9);
	context.lineTo(0, -size * 0.7);
	context.moveTo(0, 0);
	context.lineTo(size * 0.62, -size * 0.5);
	context.moveTo(0, 0);
	context.lineTo(-size * 0.62, -size * 0.5);
	context.stroke();
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
		let colors: string[] = [];
		const readColors = () => {
			colors = Array.from(probe.children).map((child) => getComputedStyle(child).color);
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
			const base: Particle = {
				x: Math.random() * width,
				y: initial ? Math.random() * height : -20,
				vx: 0,
				vy: 0,
				size: 0,
				rotation: Math.random() * Math.PI * 2,
				spin: 0,
				phase: Math.random() * Math.PI * 2,
				tone: Math.random(),
				depth,
			};
			switch (season) {
				case "spring":
					return {
						...base,
						x: initial ? base.x : width * (0.3 + Math.random() * 0.8),
						vx: -14 - Math.random() * 16,
						vy: 18 + Math.random() * 14,
						size: 4 + Math.random() * 3,
						spin: (Math.random() - 0.5) * 2.4,
					};
				case "summer":
					return {
						...base,
						y: height * (0.35 + Math.random() * 0.65),
						vx: (Math.random() - 0.5) * 8,
						vy: (Math.random() - 0.5) * 8,
						size: 1.6 + Math.random() * 1.2,
					};
				case "autumn":
					return {
						...base,
						vx: -6 + Math.random() * 12,
						vy: 22 + Math.random() * 16,
						size: 12 + Math.random() * 7,
						spin: (Math.random() - 0.5) * 1.6,
					};
				default:
					return {
						...base,
						vx: -4 + Math.random() * 3,
						vy: 14 + depth * 34,
						size: 0.8 + depth * 2.2,
					};
			}
		};

		let particles: Particle[] = [];
		let frame = 0;
		let last = performance.now();

		const draw = (now: number) => {
			context.clearRect(0, 0, width, height);
			for (const p of particles) {
				context.save();
				context.translate(p.x, p.y);
				switch (season) {
					case "spring": {
						context.rotate(p.rotation);
						context.globalAlpha = 0.85;
						context.fillStyle = p.tone < 0.6 ? colors[0] : colors[1];
						petal(context, p.size);
						break;
					}
					case "summer": {
						const glow = Math.max(0, Math.sin(now / 900 + p.phase)) ** 3;
						const halo = context.createRadialGradient(0, 0, 0, 0, 0, p.size * 7);
						halo.addColorStop(0, colors[2]);
						halo.addColorStop(1, "transparent");
						context.globalAlpha = 0.35 * glow;
						context.fillStyle = halo;
						context.beginPath();
						context.arc(0, 0, p.size * 7, 0, Math.PI * 2);
						context.fill();
						context.globalAlpha = 0.25 + 0.75 * glow;
						context.fillStyle = colors[2];
						context.beginPath();
						context.arc(0, 0, p.size, 0, Math.PI * 2);
						context.fill();
						break;
					}
					case "autumn": {
						context.rotate(p.rotation);
						context.globalAlpha = 0.9;
						context.fillStyle =
							p.tone < 0.5 ? colors[0] : p.tone < 0.8 ? colors[1] : colors[3];
						context.strokeStyle = colors[3];
						mapleLeaf(context, p.size);
						break;
					}
					default: {
						context.globalAlpha = 0.45 + p.depth * 0.5;
						context.fillStyle = colors[4];
						context.beginPath();
						context.arc(0, 0, p.size, 0, Math.PI * 2);
						context.fill();
					}
				}
				context.restore();
			}
		};

		const step = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			for (let i = 0; i < particles.length; i++) {
				const p = particles[i];
				if (season === "summer") {
					p.vx += (Math.random() - 0.5) * 18 * dt;
					p.vy += (Math.random() - 0.5) * 18 * dt;
					const speed = Math.hypot(p.vx, p.vy);
					if (speed > 10) {
						p.vx = (p.vx / speed) * 10;
						p.vy = (p.vy / speed) * 10;
					}
					p.x += p.vx * dt;
					p.y += p.vy * dt;
					if (p.x < -20 || p.x > width + 20 || p.y < height * 0.25 || p.y > height + 20)
						particles[i] = spawn(true);
					continue;
				}
				const sway =
					Math.sin(now / 1000 + p.phase) *
					(season === "autumn" ? 26 : season === "spring" ? 14 : 8);
				p.x += (p.vx + sway) * dt;
				p.y += p.vy * dt;
				p.rotation += p.spin * dt;
				if (p.y > height + 24 || p.x < -40 || p.x > width + 40) particles[i] = spawn(false);
			}
			draw(now);
			frame = requestAnimationFrame(step);
		};

		fitCanvas();
		readColors();
		particles = Array.from({ length: COUNT[season] }, () => spawn(true));

		const observer = new MutationObserver(readColors);
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
			if (document.hidden) cancelAnimationFrame(frame);
			else if (!reduceMotion) {
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

/** 探针：依次为主色浅、主色中、萤火、深色描边、雪、雪描边。 */
export const PARTICLE_PROBES = [
	"var(--brand-6)",
	"var(--brand-8)",
	"light-dark(var(--brand-9), var(--brand-11))",
	"var(--brand-10)",
	// 浅色页面上的雪用淡青灰，深色页面用近白
	"light-dark(var(--neutral-a6), var(--neutral-12))",
	"var(--neutral-a8)",
];
