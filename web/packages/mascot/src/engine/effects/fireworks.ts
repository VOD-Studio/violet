import { clamp, rand, TAU } from "../../lib/math";
import { svgEl } from "../../lib/svg";
import { STAGE_PALETTE } from "./primitives";
import type { EffectMounts, StageEffect } from "./types";

type Firework = {
	group: SVGGElement;
	head: SVGCircleElement;
	rays: SVGLineElement[];
	startX: number;
	startY: number;
	targetX: number;
	targetY: number;
	life: number;
	max: number;
	burstAt: number;
	radius: number;
};

/** 升空烟花:尾迹、停顿、中心闪白、放射爆发和轻微坠落。 */
export class FireworksFX implements StageEffect {
	private readonly front: SVGGElement;
	private readonly fireworks: Firework[] = [];

	constructor(mounts: EffectMounts) {
		this.front = mounts.front;
	}

	trigger(): void {
		this.clear();
		const targets = [
			{ x: 77, y: 69, delay: 0 },
			{ x: 131, y: 47, delay: 0.14 },
			{ x: 184, y: 75, delay: 0.28 },
		];
		for (const target of targets) {
			const color = STAGE_PALETTE[(Math.random() * STAGE_PALETTE.length) | 0];
			const group = svgEl("g", { opacity: "0", "pointer-events": "none" }) as SVGGElement;
			const head = svgEl("circle", {
				cx: "0",
				cy: "0",
				r: "2.2",
				fill: "#FFF3C4",
			}) as SVGCircleElement;
			const rays: SVGLineElement[] = [];
			for (let i = 0; i < 14; i++) {
				const line = svgEl("line", {
					x1: "0",
					y1: "0",
					x2: "0",
					y2: "0",
					stroke: color,
					"stroke-width": i % 3 === 0 ? "1.4" : "0.8",
					"stroke-linecap": "round",
				}) as SVGLineElement;
				group.appendChild(line);
				rays.push(line);
			}
			group.appendChild(head);
			this.front.appendChild(group);
			this.fireworks.push({
				group,
				head,
				rays,
				startX: target.x,
				startY: 226,
				targetX: target.x,
				targetY: target.y,
				life: -target.delay,
				max: 1.65,
				burstAt: 0.62,
				radius: rand(24, 34),
			});
		}
	}

	step(dt: number): void {
		for (let i = this.fireworks.length - 1; i >= 0; i--) {
			const firework = this.fireworks[i];
			firework.life += dt;
			if (firework.life >= firework.max) {
				firework.group.remove();
				this.fireworks.splice(i, 1);
				continue;
			}
			if (firework.life < 0) continue;
			const travel = clamp(firework.life / firework.burstAt, 0, 1);
			const eased = 1 - (1 - travel) ** 3;
			const x = firework.startX + (firework.targetX - firework.startX) * eased;
			const y = firework.startY + (firework.targetY - firework.startY) * eased;
			const burst = clamp(
				(firework.life - firework.burstAt) / (firework.max - firework.burstAt),
				0,
				1,
			);
			const fade = firework.life < firework.burstAt ? 0.95 : (1 - burst) ** 1.2;
			firework.group.setAttribute("opacity", fade.toFixed(3));
			firework.head.setAttribute("cx", x.toFixed(1));
			firework.head.setAttribute("cy", y.toFixed(1));
			for (let j = 0; j < firework.rays.length; j++) {
				const angle = (j / firework.rays.length) * TAU - Math.PI / 2;
				const radius =
					firework.radius * (burst < 0.16 ? burst / 0.16 : 1 - (burst - 0.16) * 0.16);
				const ray = firework.rays[j];
				ray.setAttribute("x1", x.toFixed(1));
				ray.setAttribute("y1", y.toFixed(1));
				ray.setAttribute("x2", (x + Math.cos(angle) * radius).toFixed(1));
				ray.setAttribute("y2", (y + Math.sin(angle) * radius).toFixed(1));
				ray.setAttribute("opacity", burst > 0 ? "1" : "0");
			}
		}
	}

	clear(): void {
		for (const firework of this.fireworks) firework.group.remove();
		this.fireworks.length = 0;
	}
}
