/**
 * 采用绝对坐标的 SVG 路径命令；参数顺序遵循对应的 SVG 命令。
 *
 * @remarks 当前类型不校验参数数量；调用方须提供有限数值及合法的命令参数。
 */
export interface Command {
	op: "M" | "L" | "Q" | "C" | "A" | "Z";
	/** M/L 为 2 项、Q 为 4 项、C 为 6 项、A 为 7 项、Z 为空数组；A 的旋转角单位为度。 */
	values: readonly number[];
}

/** 场景坐标系中的保守轴对齐包围盒，不包含描边宽度。 */
export interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * 保留原生曲线的几何结果，供笔迹生成、填充与渲染复用。
 *
 * @remarks 创建后不得修改命令或参数数组；字符串、包围盒和采样缓存不会随外部修改更新。
 */
export interface Geometry {
	/** SVG 路径字符串；工厂序列化时将坐标舍入至小数点后四位。 */
	readonly d: string;
	readonly commands: readonly Command[];
	readonly bounds: Bounds;
	readonly fillRule: "evenodd" | "nonzero";
	/** 至少含一个 Z 命令；不表示每个子路径均已闭合。 */
	readonly closed: boolean;
}

/** 按路径顺序排列的骨架采样点，坐标与距离采用场景单位。 */
export interface Sample {
	x: number;
	y: number;
	/** 邻点估计的单位切线；退化点采用 (1, 0)。 */
	tx: number;
	ty: number;
	/** 从当前子轮廓起点累计的折线弧长。 */
	s: number;
	/** 当前子轮廓的归一化弧长比例，范围 [0, 1]；零长度轮廓为 0。 */
	u: number;
}

/** 一个子路径的离散骨架；闭合轮廓通常包含与起点重合的末点。 */
export interface Contour {
	points: readonly Sample[];
	closed: boolean;
	length: number;
}

/**
 * 在一次场景生成期间累计采样和输出命令，超过上限时中止。
 *
 * @remarks 这是协作式预算，不能抢占第三方同步 JavaScript；算法不得重置计数。
 */
export interface Budget {
	commands: number;
	samples: number;
	/** 追加非负命令数；生成大量命令前调用，以免先分配后报错。 */
	addCommands(count: number): void;
	/** 追加非负工作样本数；采样缓存命中仍计入消费量。 */
	addSamples(count: number): void;
}

/** 单个图元的算法上下文；随机通道、预算及采样均由生成器提供。 */
export interface PenContext {
	/** 场景单位下的名义线宽；笔迹可据此计算局部宽度。 */
	readonly width: number;
	/** 场景单位下的几何近似容差，不包含手绘造型偏移，也不是最终像素误差保证。 */
	readonly precision: number;
	readonly budget: Budget;
	/** 输出图层引用的颜色角色，实际色值由渲染时的 Palette 决定。 */
	readonly strokeRole: string;
	readonly fillRole?: string;
	/**
	 * 返回 [0, 1) 中的确定性随机值，不推进共享随机状态。
	 *
	 * @param channel - 同一图元内相互独立的随机通道名称。
	 * @param index - 通道内的稳定样本索引；不应使用随遍历次序变化的全局计数。
	 */
	random(channel: string, index: number): number;
	/**
	 * 按需离散骨架并计入当前预算。
	 *
	 * @param maxStep - 最大折线段长度，采用场景单位；必须为正数。
	 */
	sample(geometry: Geometry, maxStep?: number): readonly Contour[];
}

/** 一个绘制图层；返回顺序即叠放顺序，填充与描边共用矢量几何。 */
export interface InkLayer {
	geometry: Geometry;
	mode: "stroke" | "fill";
	/** Palette 中的键，不是 CSS 色值。 */
	role: string;
	/** 仅用于 stroke 模式，采用场景单位；省略时渲染器使用 1。 */
	width?: number;
	/** [0, 1] 的图层不透明度；省略时为 1。 */
	opacity?: number;
	/** 按该几何自身的填充规则裁剪，不改变输出笔墨几何。 */
	clip?: Geometry;
	/** 变宽轮廓和颗粒沿此骨架揭示；普通区域填充不设置。 */
	reveal?: Geometry;
	/** 显现遮罩的覆盖宽度，采用场景单位；必须覆盖完整笔墨外沿。 */
	revealWidth?: number;
}

/**
 * 将语义骨架转换为可由 SVG 与 Canvas 共用的矢量图层。
 *
 * @remarks 内置与外部算法使用同一入口；不得修改输入，随机性须来自 context.random。
 * 生成器不根据 id 分派算法。生成或预算错误直接向调用方传播。
 */
export interface Pen {
	/** 观测用标识，不是核心限定的风格枚举，也不单独构成算法版本。 */
	readonly id: string;
	/** 返回完整有序图层；输出命令须计入 context.budget，不得超限后返回截断结果。 */
	generate(geometry: Geometry, context: PenContext): readonly InkLayer[];
}

/** 为区域生成矢量覆盖；算法负责遵守复合子路径的填充规则。 */
export interface Fill {
	readonly id: string;
	/** 使用 context.fillRole 引用颜色，并为可能越界的覆盖设置原始区域 clip。 */
	generate(region: Geometry, context: PenContext): readonly InkLayer[];
}

/** 场景中的语义图元；几何先生成笔墨，渲染时再应用仿射变换。 */
export interface SceneItem {
	/** 场景内应唯一且稳定；与 seed 共同确定该图元的随机序列。 */
	id: string;
	geometry: Geometry;
	/** 缺省不生成区域填充；当前生成入口还要求 geometry.closed 为 true。 */
	fillRole?: string;
	/** 箭头等语义符号可固定填充，不随场景排线改变可辨识性。 */
	fill?: Fill;
	/** 缺省使用 ink；值为 none 时不调用 Pen。 */
	strokeRole?: string;
	/** SVG/Canvas 顺序的 [a, b, c, d, e, f] 仿射矩阵；缩放也作用于生成后的线宽。 */
	transform?: readonly [number, number, number, number, number, number];
	/** 已完成布局的标签；坐标表示文本中心，size 为场景单位，渲染器不进行排版。 */
	label?: { text: string; x: number; y: number; size?: number };
}

/** 按 items 顺序绘制的场景；width/height 同时定义输出坐标范围。 */
export interface Scene {
	width: number;
	height: number;
	items: readonly SceneItem[];
}

/** 单个图元已生成的笔墨；颜色与播放进度不写入几何。 */
export interface DrawnItem {
	id: string;
	layers: readonly InkLayer[];
	label?: SceneItem["label"];
	transform?: SceneItem["transform"];
}

/** 可重复渲染的完整生成结果，不包含 DOM 或 Canvas 对象。 */
export interface DrawnScene {
	width: number;
	height: number;
	items: readonly DrawnItem[];
	/** 生成期间预算累计的输出命令数。 */
	commands: number;
	/** 包含骨架点与算法采样的预算工作量，不等同于唯一坐标数量。 */
	samples: number;
	/** 本次同步生成耗时，单位毫秒；不含后端构造、布局或实际绘制。 */
	generateMs: number;
	penId: string;
	seed: number;
}

/** 颜色角色到 CSS 色值的映射；须覆盖所有输出角色以及渲染器使用的 paper/ink。 */
export type Palette = Readonly<Record<string, string>>;

/** 一次完整生成的配置；预算不足时失败，不自动改变笔迹细节。 */
export interface GenerateOptions {
	/** 确定性随机种子，0 也是有效值。 */
	seed?: number;
	/** 正的名义线宽，采用场景单位。 */
	width?: number;
	/** 正的几何近似容差，采用场景单位，与造型偏移独立。 */
	precision?: number;
	/** 整个场景的命令预算；不是每个图元的独立额度。 */
	maxCommands?: number;
	/** 整个场景的采样预算；不能限制任意插件自身的 CPU 时间。 */
	maxSamples?: number;
	/** 默认区域填充算法；SceneItem.fill 优先，均缺省时采用实心填充。 */
	fill?: Fill;
}
