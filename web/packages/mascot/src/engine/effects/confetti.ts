import { rand, TAU } from "../../lib/math";
import { svgEl } from "../../lib/svg";
import type { Effect, EffectMounts } from "./types";

const CONFETTI_COLORS = ["#8B7CF6", "#6D5CE7", "#F4C34E", "#F472B6", "#34D399", "#FB923C"];
/** 五角星 path */
const STAR_PATH = (() => {
	const pts: string[] = [];
	for (let i = 0; i < 10; i++) {
		const a = (i * Math.PI) / 5 - Math.PI / 2;
		const r = i % 2 === 0 ? 1 : 0.42;
		pts.push(`${(Math.cos(a) * r).toFixed(3)},${(Math.sin(a) * r).toFixed(3)}`);
	}
	return `M ${pts.join(" L ")} Z`;
})();

interface ConfettiPiece {
	el: SVGElement;
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	r: number;
	rot: number;
	vr: number;
	stretch: number;
}

/** 彩屑粒子:从身体中心向外爆开的彩纸/圆点/星星,空气阻力 + 重力下坠。 */
export class ConfettiFX implements Effect {
	private readonly front: SVGGElement;
	private pieces: ConfettiPiece[] = [];

	constructor(mounts: EffectMounts) {
		this.front = mounts.front;
	}

	/** 爆出一批粒子;场上上限 60。 */
	burst(count = 20): void {
		for (let i = 0; i < count && this.pieces.length < 60; i++) {
			const ang = (i / count) * TAU + rand(-0.35, 0.35);
			const spd = rand(170, 360);
			const star = Math.random() < 0.18;
			const round = !star && Math.random() < 0.3;
			let node: SVGElement;
			if (star) {
				node = svgEl("path", { d: STAR_PATH, fill: "#F4C34E" });
			} else if (round) {
				node = svgEl("circle", {
					r: "1",
					fill: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
				});
			} else {
				node = svgEl("rect", {
					x: "-0.5",
					y: "-0.5",
					width: "1",
					height: "1",
					rx: "0.24",
					fill: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
				});
			}
			this.front.appendChild(node);
			this.pieces.push({
				el: node,
				x: 130 + Math.cos(ang) * rand(80, 100),
				y: 130 + Math.sin(ang) * rand(80, 100),
				vx: Math.cos(ang) * spd,
				vy: Math.sin(ang) * spd - rand(20, 75),
				life: 0,
				max: rand(0.45, 0.85),
				r: star ? rand(4, 7) : rand(3.5, 8),
				rot: rand(0, 360),
				vr: rand(-260, 260),
				stretch: !star && !round ? 1.9 : 1,
			});
		}
	}

	step(dt: number): void {
		if (!this.pieces.length) return;
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
			const drag = 0.94 ** (60 * dt);
			p.vx *= drag;
			p.vy = p.vy * drag + 40 * dt;
			p.rot += p.vr * dt;
			const u = p.life / p.max;
			const fd = u < 0.1 ? u / 0.1 : (1 - (u - 0.1) / 0.9) ** 1.7;
			const sz = Math.max(p.r * (1 - 0.4 * u), 0.5);
			p.el.setAttribute("opacity", fd.toFixed(3));
			p.el.setAttribute(
				"transform",
				`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(1)}) scale(${sz.toFixed(2)} ${(sz * p.stretch).toFixed(2)})`,
			);
		}
	}

	clear(): void {
		for (const p of this.pieces) p.el.remove();
		this.pieces.length = 0;
	}
}
