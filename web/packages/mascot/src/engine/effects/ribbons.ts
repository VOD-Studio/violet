import { clamp, rand, TAU } from "../../lib/math";
import { svgEl } from "../../lib/svg";
import type { Effect, EffectMounts } from "./types";

/** 轨道点:绕身体中心的倾斜圆轨道 3D 投影,z 决定画在身体前层还是后层 */
interface RibbonPoint {
	x: number;
	y: number;
	z: number;
	l: number;
}

interface RibbonOrbit {
	/** 经度 */
	lam: number;
	/** 自转角速度 (rad/s) */
	lamVel: number;
	/** 轨道面倾角 */
	tilt: number;
	/** 轨道面滚转 */
	roll: number;
	/** 轨道半径 */
	rad: number;
	radVel: number;
	/** 跟随自旋的比例 */
	follow: number;
	/** 惯性携带角速度 */
	carry: number;
	/** 拖尾弧长 (rad) */
	arc: number;
}

interface Ribbon {
	o: RibbonOrbit;
	hist: RibbonPoint[];
	life: number;
	/** 回缩进度 0~1 */
	ret: number;
	r: number;
	hue: number;
	hueSpan: number;
	hueVel: number;
	back: SVGPathElement;
	front: SVGPathElement;
	gradEl: SVGElement;
	stops: SVGStopElement[];
	manual: boolean;
}

let instanceCounter = 0;

/**
 * 彩带特效:自旋时提供前后分层拖尾,独立触发时生成少量轻薄流线。
 */
export class RibbonFX implements Effect {
	private readonly mounts: EffectMounts;
	private readonly uid = ++instanceCounter;
	private ribbons: Ribbon[] = [];
	private plane: { tilt: number; roll: number; count: number; baseHue: number } | null = null;
	private spawnAt: number[] = [];
	private spawnIdx = 0;
	private prevYaw = 0;
	private manualUntil = 0;
	private wasFast = false;
	private ribbonUid = 0;

	constructor(mounts: EffectMounts) {
		this.mounts = mounts;
	}

	/** 独立彩带效果:少量轻薄流线从角色周围展开,不依赖角色自旋。 */
	trigger(): void {
		this.clear();
		this.makePlane();
		this.manualUntil = performance.now() + 2600;
		for (let i = 0; i < 3; i++) {
			this.spawnRibbon((i / 3) * TAU + rand(-0.2, 0.2), i % 2 === 0 ? 1 : -1, true);
		}
	}

	/** 彩带逐帧:跟随自旋或独立流线运动,惯性衰减、smoothstep 回缩、色相漂移。 */
	step(now: number, dt: number, yaw: number): void {
		const dYawRaw = yaw - this.prevYaw;
		const dYaw = Number.isFinite(dYawRaw) && Math.abs(dYawRaw) <= 1.2 ? dYawRaw : 0;
		this.prevYaw = yaw;
		const vel = dYaw / dt;
		const fast = Math.abs(vel) >= 0.9;
		const standalone = now < this.manualUntil;
		const dir = vel >= 0 ? 1 : -1;

		if (fast && !this.wasFast) {
			this.makePlane();
			this.spawnAt = [];
			const cnt = this.plane?.count ?? 0;
			for (let q = 0; q < cnt; q++) {
				this.spawnAt.push(now + q * rand(55, 105));
			}
		}
		if (!fast) this.spawnAt.length = 0;
		this.wasFast = fast;
		if (Math.abs(vel) >= 5) {
			while (this.spawnAt.length && now >= this.spawnAt[0]) {
				this.spawnAt.shift();
				this.spawnRibbon(yaw - rand(0, 0.18) * dir, dir);
			}
		}

		for (let ti = this.ribbons.length - 1; ti >= 0; ti--) {
			const rb = this.ribbons[ti];
			const o = rb.o;
			const manualActive = rb.manual && standalone;
			const activeMotion = fast || manualActive;
			rb.life += dt;
			const retract = !activeMotion || rb.life > (rb.manual ? 2.4 : 5);
			rb.ret = clamp(rb.ret + (retract ? dt / 0.5 : -dt / 0.35), 0, 1);
			if (retract && rb.ret >= 1) {
				rb.back.remove();
				rb.front.remove();
				rb.gradEl.remove();
				this.ribbons.splice(ti, 1);
				continue;
			}
			if (fast && !rb.manual) {
				o.carry = vel * o.follow;
				o.lam += dYaw * o.follow + o.lamVel * dt;
			} else if (manualActive) {
				o.lam += o.lamVel * dt;
			} else {
				o.lam += (o.carry + o.lamVel) * dt;
				o.carry *= Math.exp(-2.6 * dt);
				o.lamVel *= Math.exp(-2.6 * dt);
			}
			o.rad += o.radVel * dt;

			const hist = rb.hist;
			const lastL = hist.length ? hist[hist.length - 1].l : o.lam - 0.001 * dir;
			const dl = o.lam - lastL;
			const steps = Math.min(Math.ceil(Math.abs(dl) / 0.09), 24);
			for (let st = 1; st <= steps; st++)
				hist.push(this.ribbonPoint(o, lastL + (dl * st) / steps));
			if (!hist.length) hist.push(this.ribbonPoint(o, o.lam));

			const span = o.arc * (1 - rb.ret * rb.ret * (3 - 2 * rb.ret));
			while (hist.length > 2 && Math.abs(o.lam - hist[0].l) > span) hist.shift();
			const over = Math.abs(o.lam - hist[0].l) - span;
			if (hist.length >= 2 && over > 0) {
				const tl = hist[0].l + (o.lam - hist[0].l >= 0 ? 1 : -1) * over;
				hist[0] = this.ribbonPoint(o, tl);
			}
			if (hist.length > 48) hist.splice(0, hist.length - 48);

			const zHead = Math.cos(o.lam) * Math.cos(o.tilt);
			const pz = 0.72 + 0.28 * clamp(zHead, 0, 1);
			let grow = Math.min(rb.life / (rb.manual ? 0.42 : 0.34), 1);
			grow = grow * grow * (3 - 2 * grow);
			const width =
				rb.r * pz * (rb.manual ? 1.25 : 1.7) * grow * (1 - 0.72 * rb.ret * rb.ret);
			const fade = Math.min(rb.life / (rb.manual ? 0.38 : 0.26), 1).toFixed(3);

			if (hist.length < 2 || width < 0.5) {
				rb.back.setAttribute("opacity", "0");
				rb.front.setAttribute("opacity", "0");
				continue;
			}
			const dstr = this.ribbonOutline(hist, width);
			rb.back.setAttribute("d", dstr.back);
			rb.front.setAttribute("d", dstr.front);
			rb.back.setAttribute("opacity", fade);
			rb.front.setAttribute("opacity", fade);

			const hue = rb.hue + rb.hueVel * rb.life;
			for (let si = 0; si < rb.stops.length; si++) {
				const frac = si / (rb.stops.length - 1);
				const hv = hue + frac * rb.hueSpan;
				rb.stops[si].setAttribute(
					"stop-color",
					`hsl(${(((hv % 360) + 360) % 360).toFixed(0)} 46% ${(62 + 9 * frac).toFixed(0)}%)`,
				);
			}
			const tail = hist[0];
			const headP = hist[hist.length - 1];
			rb.gradEl.setAttribute("x1", tail.x.toFixed(1));
			rb.gradEl.setAttribute("y1", tail.y.toFixed(1));
			rb.gradEl.setAttribute("x2", headP.x.toFixed(1));
			rb.gradEl.setAttribute("y2", headP.y.toFixed(1));
		}
	}

	/** 清掉运动彩带,并重置偏航采样,避免静态调试角度被误判为自旋。 */
	clear(): void {
		for (const ribbon of this.ribbons) {
			ribbon.back.remove();
			ribbon.front.remove();
			ribbon.gradEl.remove();
		}
		this.ribbons.length = 0;
		this.spawnAt.length = 0;
		this.manualUntil = 0;
		this.wasFast = false;
		this.prevYaw = Number.NaN;
	}

	/** 本次自旋的彩带轨道平面:随机倾角 + 随机基色相,一次自旋内所有彩带共享。 */
	private makePlane(): void {
		const base = rand(0, TAU);
		this.plane = {
			tilt: rand(0.16, 0.5),
			roll: base + rand(-0.12, 0.12),
			count: Math.round(rand(3, 5)),
			baseHue: rand(0, 360),
		};
		this.spawnIdx = 0;
	}

	/** 轨道点:绕身体中心 (130,147) 的倾斜圆轨道,z=cosλ·cos(tilt) 决定前后层。 */
	private ribbonPoint(o: RibbonOrbit, lam: number): RibbonPoint {
		const hx = o.rad * Math.sin(lam);
		const hy = -o.rad * Math.cos(lam) * Math.sin(o.tilt);
		const ca = Math.cos(o.roll);
		const sa = Math.sin(o.roll);
		return {
			x: 130 + hx * ca - hy * sa,
			y: 147 + hx * sa + hy * ca,
			z: Math.cos(lam) * Math.cos(o.tilt),
			l: lam,
		};
	}

	private createRibbon(cfg: { o: RibbonOrbit; r: number; hue: number; manual: boolean }): void {
		if (this.ribbons.length >= 8) return;
		this.ribbonUid++;
		const gradEl = svgEl("linearGradient", {
			id: `ribbon-grad-${this.uid}-${this.ribbonUid}`,
			gradientUnits: "userSpaceOnUse",
		});
		const stops: SVGStopElement[] = [];
		for (let s = 0; s < 5; s++) {
			const st = svgEl("stop", { offset: (s / 4).toFixed(3) }) as SVGStopElement;
			gradEl.appendChild(st);
			stops.push(st);
		}
		this.mounts.defs.appendChild(gradEl);
		const fill = `url(#ribbon-grad-${this.uid}-${this.ribbonUid})`;
		const back = svgEl("path", { fill, opacity: "0" }) as SVGPathElement;
		const front = svgEl("path", { fill, opacity: "0" }) as SVGPathElement;
		this.mounts.back.appendChild(back);
		this.mounts.front.appendChild(front);
		this.ribbons.push({
			o: cfg.o,
			hist: [],
			life: 0,
			ret: 0,
			r: cfg.r,
			hue: cfg.hue,
			hueSpan: rand(45, 95) * (Math.random() < 0.5 ? 1 : -1),
			hueVel: rand(18, 42) * (Math.random() < 0.5 ? 1 : -1),
			gradEl,
			stops,
			back,
			front,
			manual: cfg.manual,
		});
	}

	/** 自旋甩带或独立彩带:沿轨道错峰展开,层间距随数量摊薄。 */
	private spawnRibbon(lam0: number, dir: number, manual = false): void {
		const pl = this.plane;
		if (!pl) return;
		const count = manual ? 3 : pl.count;
		const tierStep = (manual ? 24 : 36) / Math.max(count - 1, 1);
		const rw = manual
			? rand(3.5, 5.5)
			: pl.count <= 3
				? rand(8, 10.5)
				: pl.count === 4
					? rand(6.6, 8.6)
					: rand(5.6, 7.4);
		this.createRibbon({
			o: {
				lam: lam0,
				lamVel: dir * rand(manual ? 0.25 : 0.5, manual ? 0.55 : 1.1),
				tilt: (manual ? rand(0.1, 0.24) : pl.tilt) + rand(-0.04, 0.04),
				roll: pl.roll + rand(-0.05, 0.05),
				rad: (manual ? 88 : 110) + this.spawnIdx * tierStep + rand(-1.5, 1.5),
				radVel: rand(0, manual ? 0.8 : 2.5),
				follow: rand(0.74, 0.94),
				carry: 0,
				arc: manual ? rand(1.4, 2.2) : rand(2.2, 3.4),
			},
			r: rw,
			hue: pl.baseHue + (360 * this.spawnIdx) / Math.max(count, 1) + rand(-14, 14),
			manual,
		});
		this.spawnIdx++;
	}

	/** 拖尾轮廓:头宽尾细 + 圆头封口,按 z 正负拆前后段。 */
	private ribbonOutline(pts: RibbonPoint[], width: number): { front: string; back: string } {
		const n = pts.length;
		if (n < 2) return { front: "", back: "" };
		const nx: number[] = [];
		const ny: number[] = [];
		for (let e = 0; e < n; e++) {
			const p0 = pts[e > 0 ? e - 1 : 0];
			const p1 = pts[e < n - 1 ? e + 1 : n - 1];
			let dx = p1.x - p0.x;
			let dy = p1.y - p0.y;
			const h = Math.hypot(dx, dy) || 1;
			dx /= h;
			dy /= h;
			const d = (width * (0.5 + (e / (n - 1)) * 0.5)) / 2;
			nx.push(-dy * d);
			ny.push(dx * d);
		}
		const cap = (idx: number) => {
			const hw = Math.max(Math.hypot(nx[idx], ny[idx]), 0.2);
			return `A${hw.toFixed(2)} ${hw.toFixed(2)} 0 0 0 `;
		};
		const seg = (a: number, b: number) => {
			let s = "";
			for (let k = a; k <= b; k++)
				s += `${k === a ? "M" : "L"}${(pts[k].x + nx[k]).toFixed(2)} ${(pts[k].y + ny[k]).toFixed(2)}`;
			s += b === n - 1 ? cap(b) : "L";
			for (let k = b; k >= a; k--)
				s += `${k === b ? "" : "L"}${(pts[k].x - nx[k]).toFixed(2)} ${(pts[k].y - ny[k]).toFixed(2)}`;
			if (a === 0)
				s += `${cap(0)}${(pts[0].x + nx[0]).toFixed(2)} ${(pts[0].y + ny[0]).toFixed(2)}`;
			return `${s}Z`;
		};
		let front = "";
		let back = "";
		let d0 = 0;
		while (d0 < n) {
			const isF = pts[d0].z >= 0;
			let i2 = d0;
			while (i2 + 1 < n && pts[i2 + 1].z >= 0 === isF) i2++;
			const a2 = Math.max(d0 - 1, 0);
			const b2 = Math.min(i2 + 1, n - 1);
			if (b2 > a2) {
				const str = seg(a2, b2);
				if (isF) front += str;
				else back += str;
			}
			d0 = i2 + 1;
		}
		return { front, back };
	}
}
