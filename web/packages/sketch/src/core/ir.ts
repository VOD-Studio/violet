import { catmullRomToCubics } from "./path.ts";
import { CLOSE, CUBIC, type InkBatch, LINE, MOVE, type Path, type Stroke } from "./types.ts";

type Base = Omit<InkBatch, "verbs" | "coords" | "spans">;

/** 逐子路径累积一个 {@link InkBatch}；内部用倍增的类型化数组，避免先装入普通数组再转换。 */
export class BatchBuilder {
	private readonly base: Base;
	private verbs = new Uint8Array(16);
	private coords = new Float32Array(64);
	private spans = new Float32Array(8);
	private nv = 0;
	private nc = 0;
	private ns = 0;

	constructor(base: Base) {
		this.base = base;
	}

	get empty(): boolean {
		return this.nv === 0;
	}

	private reserve(verbs: number, coords: number): void {
		if (this.nv + verbs > this.verbs.length) {
			const next = new Uint8Array(Math.max(this.verbs.length * 2, this.nv + verbs));
			next.set(this.verbs);
			this.verbs = next;
		}
		if (this.nc + coords > this.coords.length) {
			const next = new Float32Array(Math.max(this.coords.length * 2, this.nc + coords));
			next.set(this.coords);
			this.coords = next;
		}
	}

	private span(t0: number, t1: number): void {
		if (this.ns + 2 > this.spans.length) {
			const next = new Float32Array(this.spans.length * 2);
			next.set(this.spans);
			this.spans = next;
		}
		this.spans[this.ns++] = t0;
		this.spans[this.ns++] = t1;
	}

	/** 追加一条笔画为一个子路径；曲线笔画转为三次贝塞尔。 */
	stroke(stroke: Stroke): this {
		const p = stroke.points;
		const n = p.length / 4;
		if (n < 1) return this;
		const curve = stroke.curve && n > 2;
		this.reserve(n + 1, 2 + (n - 1) * (curve ? 6 : 2));
		this.verbs[this.nv++] = MOVE;
		this.coords[this.nc++] = p[0];
		this.coords[this.nc++] = p[1];
		if (curve) {
			catmullRomToCubics(p, 4, (c) => {
				this.verbs[this.nv++] = CUBIC;
				this.coords.set(c, this.nc);
				this.nc += 6;
			});
		} else {
			for (let i = 1; i < n; i++) {
				this.verbs[this.nv++] = LINE;
				this.coords[this.nc++] = p[i * 4];
				this.coords[this.nc++] = p[i * 4 + 1];
			}
		}
		if (stroke.closed) this.verbs[this.nv++] = CLOSE;
		this.span(p[3], p[(n - 1) * 4 + 3]);
		return this;
	}

	/** 追加一条已有路径的全部子路径，共用同一落笔时间段。 */
	path(path: Path, t0: number, t1: number): this {
		this.reserve(path.verbs.length, path.coords.length);
		for (let i = 0; i < path.verbs.length; i++) {
			this.verbs[this.nv++] = path.verbs[i];
			if (path.verbs[i] === MOVE) this.span(t0, t1);
		}
		this.coords.set(path.coords, this.nc);
		this.nc += path.coords.length;
		return this;
	}

	build(): InkBatch {
		return {
			...this.base,
			verbs: this.verbs.slice(0, this.nv),
			coords: this.coords.slice(0, this.nc),
			spans: this.spans.slice(0, this.ns),
		};
	}
}
