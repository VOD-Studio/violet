import { clamp, rand } from "../../lib/math";
import { svgEl } from "../../lib/svg";
import { SPARK_PATH } from "./primitives";
import type { EffectMounts, StageEffect } from "./types";

type Spark = {
	el: SVGPathElement;
	x: number;
	y: number;
	life: number;
	max: number;
	delay: number;
	size: number;
};

type Spotlight = {
	beam: SVGPathElement;
	glow: SVGEllipseElement;
	life: number;
	max: number;
};

/** 闪耀:聚光锥锁定角色，再以四向星芒给出一次性的完成提示。 */
export class SpotlightFX implements StageEffect {
	private readonly back: SVGGElement;
	private readonly front: SVGGElement;
	private readonly spotlights: Spotlight[] = [];
	private readonly sparks: Spark[] = [];

	constructor(mounts: EffectMounts) {
		this.back = mounts.back;
		this.front = mounts.front;
	}

	trigger(): void {
		this.clear();
		const beam = svgEl("path", {
			d: "M 92 0 L 168 0 L 151 194 Q 130 207 109 194 Z",
			fill: "#FFF1B8",
			opacity: "0",
			"pointer-events": "none",
		}) as SVGPathElement;
		const glow = svgEl("ellipse", {
			cx: "130",
			cy: "204",
			rx: "38",
			ry: "7",
			fill: "#FFF1B8",
			opacity: "0",
			"pointer-events": "none",
		}) as SVGEllipseElement;
		this.back.append(beam, glow);
		this.spotlights.push({ beam, glow, life: 0, max: 1.25 });
		for (const [i, point] of [
			{ x: 84, y: 91 },
			{ x: 176, y: 86 },
			{ x: 65, y: 151 },
			{ x: 195, y: 144 },
		].entries()) {
			const el = svgEl("path", {
				d: SPARK_PATH,
				fill: "#FFF3C4",
				opacity: "0",
				"pointer-events": "none",
			}) as SVGPathElement;
			this.front.appendChild(el);
			this.sparks.push({
				el,
				x: point.x,
				y: point.y,
				life: 0,
				max: 0.9,
				delay: i * 0.12,
				size: rand(4, 6),
			});
		}
	}

	step(dt: number): void {
		for (let i = this.spotlights.length - 1; i >= 0; i--) {
			const spotlight = this.spotlights[i];
			spotlight.life += dt;
			if (spotlight.life >= spotlight.max) {
				spotlight.beam.remove();
				spotlight.glow.remove();
				this.spotlights.splice(i, 1);
				continue;
			}
			const u = spotlight.life / spotlight.max;
			const fade = u < 0.2 ? u / 0.2 : (1 - u) ** 1.2;
			spotlight.beam.setAttribute("opacity", (fade * 0.11).toFixed(3));
			spotlight.glow.setAttribute("opacity", (fade * 0.38).toFixed(3));
			spotlight.glow.setAttribute("rx", (38 + Math.sin(u * Math.PI) * 10).toFixed(1));
		}
		for (let i = this.sparks.length - 1; i >= 0; i--) {
			const spark = this.sparks[i];
			spark.life += dt;
			const t = spark.life - spark.delay;
			if (t >= spark.max) {
				spark.el.remove();
				this.sparks.splice(i, 1);
				continue;
			}
			if (t < 0) continue;
			const u = t / spark.max;
			const fade = u < 0.18 ? u / 0.18 : (1 - u) ** 1.35;
			spark.el.setAttribute("opacity", clamp(fade, 0, 1).toFixed(3));
			spark.el.setAttribute(
				"transform",
				`translate(${spark.x} ${spark.y}) scale(${(spark.size * (1 + Math.sin(u * Math.PI) * 0.25)).toFixed(2)})`,
			);
		}
	}

	clear(): void {
		for (const spotlight of this.spotlights) {
			spotlight.beam.remove();
			spotlight.glow.remove();
		}
		for (const spark of this.sparks) spark.el.remove();
		this.spotlights.length = 0;
		this.sparks.length = 0;
	}
}
