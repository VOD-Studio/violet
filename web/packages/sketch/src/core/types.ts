import type { RandomSource } from "./rng.ts";

/** 路径动词编码，与 {@link Path.verbs} 对应。 */
export const MOVE = 0;
export const LINE = 1;
export const CUBIC = 2;
export const CLOSE = 3;

/** 场景坐标系中的轴对齐包围盒；曲线按控制点保守估计，不含线宽。 */
export interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * 只含 M/L/C/Z 的绝对坐标路径；二次曲线已升阶，圆弧已转为三次贝塞尔。
 *
 * @remarks 按不可变值使用：展平缓存以对象身份为键，修改数组会使缓存失效。
 */
export interface Path {
	/** 动词序列：0=M 1=L 2=C 3=Z。 */
	readonly verbs: Uint8Array;
	/** 按动词依次存放坐标：M/L 两个、C 六个、Z 无。 */
	readonly coords: Float64Array;
	readonly fillRule: "nonzero" | "evenodd";
	readonly bounds: Bounds;
}

/** 展平后的一条子轮廓。 */
export interface Contour {
	/** 交错存放的折线坐标 [x0, y0, x1, y1, …]；闭合轮廓不重复起点。 */
	readonly points: Float64Array;
	/** 每个顶点距轮廓起点的累计折线弧长；闭合轮廓的总长含回到起点的末段。 */
	readonly arc: Float64Array;
	/** 切线方向突变超过角点阈值的顶点下标，升序。 */
	readonly corners: Uint32Array;
	readonly closed: boolean;
	readonly length: number;
}

/** 手法输入：图形或填充图案的骨架。 */
export interface Skeleton {
	readonly contours: readonly Contour[];
	readonly fillRule: Path["fillRule"];
}

/** 一次落笔到抬笔。 */
export interface Stroke {
	/** [x, y, pressure, t] × n；t 为任意时间单位，生成器会按图元归一化。 */
	readonly points: Float32Array;
	/** true 时 points 为 Catmull-Rom 控制点，成形时转为三次贝塞尔；false 时为折线顶点。 */
	readonly curve: boolean;
	readonly closed: boolean;
	/** 复画序号：0 为主笔，大于 0 为草稿复线。 */
	readonly pass: number;
}

/** 渲染单元：同一绘制属性的笔墨合为一批。 */
export interface InkBatch {
	readonly mode: "stroke" | "fill";
	/** Palette 中的颜色角色键，不是 CSS 色值。 */
	readonly role: string;
	/** 仅 stroke 模式使用，场景单位；省略时为 1。 */
	readonly width?: number;
	/** [0, 1]；省略时为 1。 */
	readonly opacity?: number;
	readonly fillRule?: Path["fillRule"];
	readonly verbs: Uint8Array;
	readonly coords: Float32Array;
	/** 每个子路径的落笔时间 [t0, t1]，按图元归一化到 [0, 1]。 */
	readonly spans: Float32Array;
	/**
	 * 变宽笔画的条带结构，每个子路径两项 [n, c]；非条带子路径为 [0, 0]。
	 * 条带子路径依次为：左侧 n 个点、末端帽 c 个点、右侧 n 个点（自末向首）、起端帽 c 个点，供动画按前缀显现。
	 */
	readonly ribbons?: Uint32Array;
	/** 按该路径自身的填充规则裁剪。 */
	readonly clip?: Path;
}

/** 预算计数；超过上限时抛出 BudgetExceeded，不返回部分结果。 */
export interface Budget {
	readonly vertices: number;
	readonly strokes: number;
}

/** 单个图元生成期间的上下文。 */
export interface DrawContext extends RandomSource {
	/** 名义线宽，场景单位。 */
	readonly width: number;
	/** 几何展平容差，场景单位；与手法造型偏移相互独立。 */
	readonly precision: number;
	/** 场景单位到 CSS 像素的比例，用于判断细节是否可见。 */
	readonly pixelScale: number;
	/** 开放路径首尾是否保持精确。 */
	readonly pinEnds: boolean;
	/** 当前图元的填充颜色角色；风格据此推导阴影、高光等派生角色。 */
	readonly fillRole?: string;
	/** 按当前 precision 展平任意路径，命中共享缓存。 */
	flatten(path: Path): Skeleton;
}

/** 手法：把骨架变成笔画。不得修改输入，随机只能来自 ctx。 */
export interface Hand {
	readonly id: string;
	strokes(skeleton: Skeleton, ctx: DrawContext): readonly Stroke[];
}

/** 笔：把笔画成形为渲染批次。 */
export interface Pen {
	readonly id: string;
	ink(strokes: readonly Stroke[], ctx: DrawContext, role: string): readonly InkBatch[];
}

/** 填充：返回直接上色的区域，或交给手法与笔描绘的图案骨架。 */
/** 直接上色的区域。 */
export interface Area {
	readonly path: Path;
	/** 颜色角色；缺省为图元的 fillRole。 */
	readonly role?: string;
	readonly opacity?: number;
	/** 裁剪范围：true 为图元原路径，也可指定任意路径。 */
	readonly clip?: boolean | Path;
}

export interface FillOutput {
	/** 实色区域，按自身填充规则上色，不经过笔；按数组顺序叠放。 */
	readonly areas?: readonly Area[];
	/** 图案骨架；由填充手法转为笔画，再由填充笔成形，并裁剪到原区域。 */
	readonly guides?: Skeleton;
}

export interface Fill {
	readonly id: string;
	/**
	 * @param region - 按当前精度展平的区域
	 * @param source - 原始路径，供需要保留曲线的区域填充直接使用
	 */
	generate(region: Skeleton, ctx: DrawContext, source: Path): FillOutput;
}

/** 笔、手法与填充的组合。 */
export interface Style {
	readonly hand: Hand;
	readonly pen: Pen;
	/** 缺省为实色填充。 */
	readonly fill?: Fill;
	/** 缺省使用 hand。 */
	readonly fillHand?: Hand;
	/** 缺省使用 pen。 */
	readonly fillPen?: Pen;
	/** 填充笔相对名义线宽的倍率。 @default 0.5 */
	readonly fillWeight?: number;
	/** 图元未指定 strokeRole 时，由填充角色推导描边角色；缺省为 ink。 */
	readonly lineRole?: (fillRole: string | undefined) => string;
}

/** SVG/Canvas 顺序的 [a, b, c, d, e, f] 仿射矩阵。 */
export type Matrix = readonly [number, number, number, number, number, number];

/** 已完成布局的文字；坐标为文本中心，渲染器不排版。 */
export interface Label {
	text: string;
	x: number;
	y: number;
	/** 场景单位字号。 @default 14 */
	size?: number;
}

export interface SceneItem {
	/** 场景内唯一且稳定；与 seed 共同决定该图元的随机序列。 */
	id: string;
	path: Path;
	/** 缺省使用 draw 选项中的 style。 */
	style?: Style;
	/** 缺省 ink；none 表示不描边。 */
	strokeRole?: string;
	/** 缺省不填充；仅对含闭合子路径的路径生效。 */
	fillRole?: string;
	/** 开放路径首尾保持精确，用于连线与箭头锚点。 */
	pinEnds?: boolean;
	/** 该图元的名义线宽，场景单位；缺省取 draw 选项的 width。 */
	lineWidth?: number;
	transform?: Matrix;
	label?: Label;
}

export interface Scene {
	width: number;
	height: number;
	items: readonly SceneItem[];
}

export interface DrawOptions {
	style: Style;
	/** 0 也是有效 seed。 @default 1 */
	seed?: number;
	/** @default 2 */
	width?: number;
	/** @default 0.25 */
	precision?: number;
	/** @default 1 */
	pixelScale?: number;
	/** 整个场景的输出顶点上限。 @default 2000000 */
	maxVertices?: number;
	/** 整个场景的笔画上限。 @default 200000 */
	maxStrokes?: number;
}

export interface DrawnItem {
	readonly id: string;
	/** 按叠放顺序：填充在下，描边在上。 */
	readonly batches: readonly InkBatch[];
	readonly transform?: Matrix;
	readonly label?: Label;
}

/** 可重复渲染的完整生成结果，不含 DOM 对象。 */
export interface Drawing {
	readonly width: number;
	readonly height: number;
	readonly items: readonly DrawnItem[];
	readonly seed: number;
	readonly budget: Budget;
	/** 同步生成耗时，毫秒。 */
	readonly generateMs: number;
}

export type { RandomSource };
