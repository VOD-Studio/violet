import { rand, TAU } from "../../lib/math";
import { svgEl } from "../../lib/svg";
import type { Effect, EffectMounts } from "./types";

/** 独立特效使用高对比糖果色，避免与角色本体的紫色轮廓混在一起。 */
const COLORS = ["#F4C34E", "#F472B6", "#8B7CF6", "#34D399", "#67E8F9"];
/** 统一的四向闪星路径，缩放后复用于魔法阵与登场闪耀。 */
const STAR = "M 0 -1 L 0.24 -0.24 L 1 0 L 0.24 0.24 L 0 1 L -0.24 0.24 L -1 0 L -0.24 -0.24 Z";

type StagePiece = {
	el: SVGElement;
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	size: number;
	rot: number;
	spin: number;
	gravity: number;
};

/** 独立舞台特效:魔法阵、烟花、爱心雨、流星和登场闪耀。 */
export class StageFX implements Effect {
	private readonly back: SVGGElement;
	private readonly front: SVGGElement;
	private rings: {
		el: SVGElement;
		life: number;
		max: number;
		size: number;
		x: number;
		y: number;
		radius: number;
	}[] = [];
	private readonly pieces: StagePiece[] = [];

	constructor(mounts: EffectMounts) {
		this.back = mounts.back;
		this.front = mounts.front;
	}

	/** 脚下双层符文光圈与上浮闪星。 */
	magic(): void {
		this.addRing(130, 211, 34, "#A78BFA", 0.9, 0.9);
		this.addRing(130, 211, 18, "#F4C34E", 0.7, 0.6);
		for (let i = 0; i < 10; i++) {
			const a = (i / 10) * TAU;
			this.addPiece(
				"path",
				STAR,
				130 + Math.cos(a) * 34,
				205 + Math.sin(a) * 8,
				Math.cos(a) * 10,
				-18,
				0.8,
				3.2,
				0,
			);
		}
	}

	/** 三组错位爆点，分别承担远、中、近景层次。 */
	fireworks(): void {
		for (let i = 0; i < 3; i++) {
			const x = 76 + i * 54 + rand(-8, 8);
			const y = rand(42, 86);
			for (let j = 0; j < 12; j++) {
				const a = (j / 12) * TAU;
				this.addPiece(
					"circle",
					undefined,
					x,
					y,
					Math.cos(a) * rand(38, 68),
					Math.sin(a) * rand(38, 68),
					0.9,
					rand(2, 4),
					16,
				);
			}
		}
	}

	/** 从舞台顶部缓慢落下的爱心粒子。 */
	hearts(): void {
		for (let i = 0; i < 12; i++) {
			const x = rand(38, 222);
			this.addPiece(
				"path",
				"M 0 2 C -5 -3 -8 -8 0 -5 C 8 -8 5 -3 0 2 Z",
				x,
				-10 - rand(0, 30),
				rand(-8, 8),
				rand(18, 34),
				rand(2.8, 4.4),
				rand(3, 6),
				0,
			);
		}
	}

	/** 从左上方向右下方掠过的短尾流星。 */
	meteors(): void {
		for (let i = 0; i < 7; i++) {
			this.addPiece(
				"path",
				"M -18 0 L 0 1 L 5 0 L 0 -1 Z",
				rand(-20, 30),
				rand(20, 120),
				rand(80, 130),
				rand(35, 65),
				rand(0.8, 1.3),
				rand(0.4, 0.7),
				0,
			);
		}
	}

	/** 角色周围的暖金闪耀环与四向星光。 */
	spotlight(): void {
		this.addRing(130, 124, 82, "#FFF1B8", 0.8, 0.8);
		for (let i = 0; i < 8; i++) {
			const a = (i / 8) * TAU;
			this.addPiece(
				"path",
				STAR,
				130 + Math.cos(a) * 65,
				125 + Math.sin(a) * 50,
				Math.cos(a) * 12,
				Math.sin(a) * 12,
				0.7,
				rand(2, 4),
				0,
			);
		}
	}

	/** 推进所有独立粒子并回收已结束的 SVG 节点。 */
	step(dt: number): void {
		for (let i = this.pieces.length - 1; i >= 0; i--) {
			const p = this.pieces[i];
			p.life += dt;
			if (p.life >= p.max) {
				p.el.remove();
				this.pieces.splice(i, 1);
				continue;
			}
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.vy += p.gravity * dt;
			p.rot += p.spin * dt;
			const u = p.life / p.max;
			const opacity = u < 0.16 ? u / 0.16 : (1 - u) ** 1.4;
			p.el.setAttribute("opacity", opacity.toFixed(3));
			p.el.setAttribute(
				"transform",
				`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(1)}) scale(${p.size.toFixed(2)})`,
			);
		}
		for (let i = this.rings.length - 1; i >= 0; i--) {
			const ring = this.rings[i];
			ring.life += dt;
			if (ring.life >= ring.max) {
				ring.el.remove();
				this.rings.splice(i, 1);
				continue;
			}
			const u = ring.life / ring.max;
			const radius = ring.radius * (1 + u * ring.size);
			ring.el.setAttribute("opacity", ((1 - u) * 0.75).toFixed(3));
			ring.el.setAttribute("rx", radius.toFixed(1));
			ring.el.setAttribute("ry", (radius * 0.24).toFixed(1));
		}
	}

	clear(): void {
		for (const p of this.pieces) p.el.remove();
		for (const r of this.rings) r.el.remove();
		this.pieces.length = 0;
		this.rings.length = 0;
	}

	private addRing(
		x: number,
		y: number,
		radius: number,
		color: string,
		max: number,
		size: number,
	): void {
		const el = svgEl("ellipse", {
			cx: String(x),
			cy: String(y),
			rx: String(radius),
			ry: String(radius * 0.24),
			fill: "none",
			stroke: color,
			"stroke-width": "1.5",
		});
		this.back.appendChild(el);
		this.rings.push({ el, life: 0, max, size, x, y, radius });
	}

	private addPiece(
		type: string,
		d: string | undefined,
		x: number,
		y: number,
		vx: number,
		vy: number,
		max: number,
		size: number,
		gravity: number,
	): void {
		const el =
			type === "circle"
				? svgEl("circle", { r: "1", fill: COLORS[(Math.random() * COLORS.length) | 0] })
				: svgEl(type, { d: d ?? STAR, fill: COLORS[(Math.random() * COLORS.length) | 0] });
		this.front.appendChild(el);
		this.pieces.push({
			el,
			x,
			y,
			vx,
			vy,
			life: 0,
			max,
			size,
			rot: rand(0, 360),
			spin: rand(-240, 240),
			gravity,
		});
	}
}
