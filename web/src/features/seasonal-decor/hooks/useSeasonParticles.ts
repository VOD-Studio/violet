/**
 * 渲染一季飘落粒子：春花瓣斜飘翻转；夏萤火原地游走明灭；秋落叶缓慢打旋；冬雪分远近下落。
 *
 * 粒子按远近分层：远景小、慢、淡且虚化。隐藏标签页时暂停；减弱动态时只画一帧静止画面。
 */
import { useReducedMotion } from "@shared/lib/motion";
import type { Season } from "@shared/lib/theme-preference";
import { useEffect, useRef } from "react";

import { buildParticleSprites, SPRITE_SIZE, SPRITES_PER_BLUR } from "../lib/particle-sprites";

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

const COUNT: Record<Season, number> = { spring: 22, summer: 20, autumn: 12, winter: 110 };

/**
 * 挂到画布与颜色探针元素上的 ref。
 *
 * @param season - 要投放的季节；null 时不动画布
 */
export function useSeasonParticles(season: Season | null) {
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
		const perBlur = SPRITES_PER_BLUR[season];
		const readColors = () => {
			const colors = Array.from(probe.children).map((child) => getComputedStyle(child).color);
			sprites = buildParticleSprites(season, colors);
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
				const drawn = (p.size / (SPRITE_SIZE * 0.3)) * SPRITE_SIZE;
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
