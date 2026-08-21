import { clamp, rand, TAU } from "../../lib/math";
import { svgEl } from "../../lib/svg";
import { HEART_PATH } from "./primitives";
import type { EffectMounts, StageEffect } from "./types";

type Heart = {
	el: SVGPathElement;
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	delay: number;
	size: number;
	rot: number;
	spin: number;
	sway: number;
	phase: number;
};

/** 爱心雨:前后景错层、低速下落和轻微摆动，表达持续祝福而非粒子爆炸。 */
export class HeartRainFX implements StageEffect {
	private readonly front: SVGGElement;
	private readonly hearts: Heart[] = [];

	constructor(mounts: EffectMounts) {
		this.front = mounts.front;
	}

	trigger(): void {
		this.clear();
		for (let i = 0; i < 11; i++) {
			const foreground = i < 4;
			const el = svgEl("path", {
				d: HEART_PATH,
				fill: foreground ? "#F08AAE" : "#F6C95B",
				stroke: "#FFF3E0",
				"stroke-width": foreground ? "0.55" : "0.35",
				opacity: "0",
				"pointer-events": "none",
			}) as SVGPathElement;
			this.front.appendChild(el);
			this.hearts.push({
				el,
				x: rand(32, 228),
				y: -rand(8, 55),
				vx: rand(-3, 3),
				vy: rand(17, 28),
				life: 0,
				max: rand(2.3, 3.1),
				delay: i * 0.1,
				size: foreground ? rand(1.1, 1.35) : rand(0.62, 0.9),
				rot: rand(-16, 16),
				spin: rand(-18, 18),
				sway: foreground ? rand(3, 6) : rand(5, 9),
				phase: rand(0, TAU),
			});
		}
	}

	step(dt: number): void {
		for (let i = this.hearts.length - 1; i >= 0; i--) {
			const heart = this.hearts[i];
			heart.life += dt;
			const t = heart.life - heart.delay;
			if (t >= heart.max) {
				heart.el.remove();
				this.hearts.splice(i, 1);
				continue;
			}
			if (t < 0) continue;
			heart.x += (heart.vx + Math.sin(heart.phase + t * 2.6) * heart.sway) * dt;
			heart.y += heart.vy * dt;
			heart.rot += heart.spin * dt;
			const u = t / heart.max;
			const opacity = u < 0.12 ? u / 0.12 : (1 - u) ** 1.35;
			heart.el.setAttribute("opacity", clamp(opacity, 0, 1).toFixed(3));
			heart.el.setAttribute(
				"transform",
				`translate(${heart.x.toFixed(1)} ${heart.y.toFixed(1)}) rotate(${heart.rot.toFixed(1)}) scale(${heart.size.toFixed(2)})`,
			);
		}
	}

	clear(): void {
		for (const heart of this.hearts) heart.el.remove();
		this.hearts.length = 0;
	}
}
