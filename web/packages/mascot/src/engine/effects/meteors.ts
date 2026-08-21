import { clamp, rand } from "../../lib/math";
import { svgEl } from "../../lib/svg";
import { SPARK_PATH } from "./primitives";
import type { EffectMounts, StageEffect } from "./types";

type Meteor = {
	group: SVGGElement;
	head: SVGCircleElement;
	tail: SVGLineElement;
	spark: SVGPathElement;
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	length: number;
};

/** 流星:固定左上至右下的许愿轨迹，头部、分段尾迹和尾端星芒同步移动。 */
export class MeteorsFX implements StageEffect {
	private readonly front: SVGGElement;
	private readonly meteors: Meteor[] = [];

	constructor(mounts: EffectMounts) {
		this.front = mounts.front;
	}

	trigger(): void {
		this.clear();
		for (let i = 0; i < 4; i++) {
			const group = svgEl("g", { opacity: "0", "pointer-events": "none" }) as SVGGElement;
			const color = i % 2 ? "#9AD7FF" : "#F6C95B";
			const tail = svgEl("line", {
				x1: "0",
				y1: "0",
				x2: "0",
				y2: "0",
				stroke: color,
				"stroke-width": "1.2",
				"stroke-linecap": "round",
			}) as SVGLineElement;
			const head = svgEl("circle", {
				cx: "0",
				cy: "0",
				r: "2",
				fill: "#FFFBE7",
			}) as SVGCircleElement;
			const spark = svgEl("path", { d: SPARK_PATH, fill: "#FFFBE7" }) as SVGPathElement;
			group.append(tail, head, spark);
			this.front.appendChild(group);
			this.meteors.push({
				group,
				head,
				tail,
				spark,
				x: rand(-30, 55),
				y: rand(16, 108),
				vx: rand(100, 140),
				vy: rand(48, 76),
				life: -i * 0.14,
				max: rand(0.95, 1.25),
				length: rand(24, 40),
			});
		}
	}

	step(dt: number): void {
		for (let i = this.meteors.length - 1; i >= 0; i--) {
			const meteor = this.meteors[i];
			meteor.life += dt;
			if (meteor.life >= meteor.max) {
				meteor.group.remove();
				this.meteors.splice(i, 1);
				continue;
			}
			if (meteor.life < 0) continue;
			meteor.x += meteor.vx * dt;
			meteor.y += meteor.vy * dt;
			const angle = Math.atan2(meteor.vy, meteor.vx);
			const u = meteor.life / meteor.max;
			const fade = u < 0.12 ? u / 0.12 : (1 - u) ** 1.25;
			const tailX = meteor.x - Math.cos(angle) * meteor.length;
			const tailY = meteor.y - Math.sin(angle) * meteor.length;
			meteor.group.setAttribute("opacity", clamp(fade, 0, 1).toFixed(3));
			meteor.head.setAttribute("cx", meteor.x.toFixed(1));
			meteor.head.setAttribute("cy", meteor.y.toFixed(1));
			meteor.tail.setAttribute("x1", tailX.toFixed(1));
			meteor.tail.setAttribute("y1", tailY.toFixed(1));
			meteor.tail.setAttribute("x2", meteor.x.toFixed(1));
			meteor.tail.setAttribute("y2", meteor.y.toFixed(1));
			meteor.spark.setAttribute(
				"transform",
				`translate(${meteor.x.toFixed(1)} ${meteor.y.toFixed(1)}) scale(${(1.5 + Math.sin(u * Math.PI) * 1.8).toFixed(2)})`,
			);
		}
	}

	clear(): void {
		for (const meteor of this.meteors) meteor.group.remove();
		this.meteors.length = 0;
	}
}
