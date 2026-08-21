import { clamp, rand, TAU } from "../../lib/math";
import { svgEl } from "../../lib/svg";
import { SPARK_PATH, STAR_PATH } from "./primitives";
import type { EffectMounts, StageEffect } from "./types";

type Glyph = {
	el: SVGPathElement;
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	delay: number;
	size: number;
	phase: number;
};

/** 地面召唤阵:先在水平圆盘上旋转，再统一压缩为舞台地面透视。 */
export class MagicCircleFX implements StageEffect {
	private readonly back: SVGGElement;
	private readonly front: SVGGElement;
	private circle: SVGGElement | null = null;
	private readonly glyphs: Glyph[] = [];
	private life = 0;
	private readonly maxLife = 1.65;

	constructor(mounts: EffectMounts) {
		this.back = mounts.back;
		this.front = mounts.front;
	}

	trigger(): void {
		this.clear();
		this.life = 0;
		this.circle = this.createCircle();
		this.back.appendChild(this.circle);
		for (let i = 0; i < 6; i++) {
			const angle = (i / 6) * TAU + Math.PI / 6;
			const el = svgEl("path", {
				d: i % 2 ? SPARK_PATH : STAR_PATH,
				fill: "#FFF3C4",
				opacity: "0",
				"pointer-events": "none",
			}) as SVGPathElement;
			this.front.appendChild(el);
			this.glyphs.push({
				el,
				x: 130 + Math.cos(angle) * 84,
				y: 232 + Math.sin(angle) * 20,
				vx: Math.cos(angle) * 1.2,
				vy: -rand(6, 10),
				life: 0,
				max: 0.72,
				delay: i * 0.05,
				size: rand(1.8, 2.6),
				phase: angle,
			});
		}
	}

	step(dt: number): void {
		if (this.circle) {
			this.life += dt;
			if (this.life >= this.maxLife) {
				this.circle.remove();
				this.circle = null;
			} else {
				const u = this.life / this.maxLife;
				const reveal = u < 0.28 ? u / 0.28 : 1 - Math.max(0, u - 0.72) / 0.28;
				const scale = 0.48 + Math.min(u, 0.42) * 1.24;
				// 环在水平圆盘坐标系内反向旋转，再由 root 的非等比缩放投影到地面。
				this.circle.setAttribute("opacity", (clamp(reveal, 0, 1) * 0.84).toFixed(3));
				this.circle.setAttribute(
					"transform",
					`translate(130 232) scale(${(1.04 * scale).toFixed(3)} ${(0.25 * scale).toFixed(3)})`,
				);
				this.circle
					.querySelector("[data-ring=outer]")
					?.setAttribute("transform", `rotate(${(u * 110).toFixed(1)})`);
				this.circle
					.querySelector("[data-ring=inner]")
					?.setAttribute("transform", `rotate(${(-u * 165).toFixed(1)})`);
			}
		}
		for (let i = this.glyphs.length - 1; i >= 0; i--) {
			const glyph = this.glyphs[i];
			glyph.life += dt;
			const t = glyph.life - glyph.delay;
			if (t >= glyph.max) {
				glyph.el.remove();
				this.glyphs.splice(i, 1);
				continue;
			}
			if (t < 0) continue;
			glyph.x += glyph.vx * dt;
			glyph.y += glyph.vy * dt;
			const u = t / glyph.max;
			const opacity = u < 0.15 ? u / 0.15 : (1 - u) ** 1.4;
			glyph.el.setAttribute("opacity", clamp(opacity, 0, 1).toFixed(3));
			glyph.el.setAttribute(
				"transform",
				`translate(${glyph.x.toFixed(1)} ${glyph.y.toFixed(1)}) rotate(${(glyph.phase * 57.3 + t * 80).toFixed(1)}) scale(${glyph.size.toFixed(2)})`,
			);
		}
	}

	clear(): void {
		this.circle?.remove();
		this.circle = null;
		for (const glyph of this.glyphs) glyph.el.remove();
		this.glyphs.length = 0;
		this.life = 0;
	}

	private createCircle(): SVGGElement {
		const root = svgEl("g", {
			opacity: "0",
			transform: "translate(130 232) scale(0.5 0.125)",
			"pointer-events": "none",
		}) as SVGGElement;
		const glow = svgEl("ellipse", {
			rx: "112",
			ry: "78",
			fill: "none",
			stroke: "#8B7BFF",
			"stroke-width": "18",
			opacity: "0.09",
		});
		const outer = svgEl("g", { "data-ring": "outer" });
		const inner = svgEl("g", { "data-ring": "inner" });
		outer.append(
			svgEl("circle", {
				r: "105",
				fill: "none",
				stroke: "#A997FF",
				"stroke-width": "1.2",
				"stroke-dasharray": "2 7 18 4 30 6",
			}),
			svgEl("circle", {
				r: "93",
				fill: "none",
				stroke: "#F6C95B",
				"stroke-width": "0.9",
				"stroke-dasharray": "1 5 12 3",
			}),
		);
		inner.append(
			svgEl("circle", {
				r: "68",
				fill: "none",
				stroke: "#FFF3C4",
				"stroke-width": "0.7",
				"stroke-dasharray": "1 6",
			}),
			svgEl("circle", {
				r: "42",
				fill: "none",
				stroke: "#A997FF",
				"stroke-width": "0.65",
				"stroke-dasharray": "3 8",
			}),
		);
		for (let i = 0; i < 12; i++) {
			const angle = (i / 12) * TAU;
			const major = i % 3 === 0;
			outer.appendChild(
				svgEl("line", {
					x1: String(Math.cos(angle) * (major ? 93 : 98)),
					y1: String(Math.sin(angle) * (major ? 93 : 98)),
					x2: String(Math.cos(angle) * 104),
					y2: String(Math.sin(angle) * 104),
					stroke: major ? "#F6C95B" : "#A997FF",
					"stroke-width": major ? "1.5" : "0.65",
					"stroke-linecap": "round",
				}),
			);
		}
		for (let i = 0; i < 8; i++) {
			const angle = (i / 8) * TAU;
			const rune = svgEl("path", {
				d: "M -4 -5 L 0 5 L 4 -5 M -4 0 L 4 0",
				fill: "none",
				stroke: "#FFF3C4",
				"stroke-width": "0.9",
				opacity: "0.75",
				transform: `translate(${(Math.cos(angle) * 76).toFixed(1)} ${(Math.sin(angle) * 76).toFixed(1)}) rotate(${((angle * 180) / Math.PI + 90).toFixed(1)})`,
			});
			inner.appendChild(rune);
		}
		const sigil = svgEl("g", { "data-sigil": "true" });
		sigil.append(
			svgEl("path", {
				d: "M 0 -18 L 5 -5 L 18 0 L 5 5 L 0 18 L -5 5 L -18 0 L -5 -5 Z",
				fill: "none",
				stroke: "#FFF3C4",
				"stroke-width": "1",
			}),
			svgEl("circle", { r: "4", fill: "none", stroke: "#F6C95B", "stroke-width": "0.8" }),
		);
		root.append(glow, outer, inner, sigil);
		return root;
	}
}
