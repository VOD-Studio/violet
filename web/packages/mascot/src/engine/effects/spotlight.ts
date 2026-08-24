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

/** 舞台灯光驱动位：0 静默，1 满格；宿主环境层（beam/source/pool）按此变量起伏。 */
const GLOW_VAR = "--mascot-spotlight";

/**
 * 闪耀:不另画光源，而是驱动宿主舞台的真实灯光——把 GLOW_VAR
 * 从 0 推到峰值再回落，光锥、顶光与地面光池随之起伏；
 * 四向星芒作为一次性的完成提示画在角色前层。
 */
export class SpotlightFX implements StageEffect {
	private readonly front: SVGGElement;
	/** 特效写入 GLOW_VAR 的目标：宿主元素的父级（舞台环境容器）。 */
	private readonly ambient: HTMLElement | null;
	private readonly sparks: Spark[] = [];
	private glowLife = -1;

	constructor(mounts: EffectMounts, host: HTMLElement) {
		this.front = mounts.front;
		this.ambient = host.parentElement;
	}

	trigger(): void {
		this.clear();
		this.glowLife = 0;
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
		if (this.glowLife >= 0) {
			this.glowLife += dt;
			const max = 1.25;
			if (this.glowLife >= max) {
				this.setGlow(null);
				this.glowLife = -1;
			} else {
				const u = this.glowLife / max;
				// 前 20% 快速推亮，随后幂次回落，与星芒节奏一致
				const fade = u < 0.2 ? u / 0.2 : (1 - u) ** 1.2;
				this.setGlow(clamp(fade, 0, 1));
			}
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
		this.setGlow(null);
		this.glowLife = -1;
		for (const spark of this.sparks) spark.el.remove();
		this.sparks.length = 0;
	}

	private setGlow(level: number | null): void {
		this.ambient?.style.setProperty(GLOW_VAR, level === null ? "" : level.toFixed(3));
	}
}
