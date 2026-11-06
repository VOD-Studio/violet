/** 视口坐标下的矩形，单位 px。 */
export interface Box {
	left: number;
	top: number;
	width: number;
	height: number;
}

/** 外形的一个瞬间：矩形、圆角与底色。 */
export interface Shape extends Box {
	radius: number;
	background: string;
}

export interface MorphParts {
	/** 外形：只动 clip-path 与底色，内容始终按最终大小排好。 */
	panel: HTMLElement;
	/** 软影：clip-path 会裁掉面板自己的阴影，所以单独放在面板下面，外形到位后才浮起。 */
	shadow: HTMLElement;
	body: HTMLElement;
	/**
	 * 起点上那张东西的副本：外形长出时它模糊淡出。`returns` 为真时（副本是触发器上的字），
	 * 收起的最后一段它再浮现；接力时的副本是旧面板，收起时不再出现。
	 */
	ghost: { element: HTMLElement; returns: boolean } | null;
	/** 面板最终的圆角。 */
	radius: number;
}

export interface Morph {
	/** 从 `from` 长成整块面板；正在收回时省略 `from`，从当前形状再长出来。 */
	expand(from?: Shape): void;
	/** 缩回 `to`；缩完调用 `done`，被打断则不调用。 */
	collapse(to: Shape, done: () => void): void;
	/** 此刻面板看得见的外形；接力时交给下一块面板作起点。 */
	shape(): Shape;
	dispose(): void;
}

const EXPAND_MS = 480;
const COLLAPSE_MS = 220;
const COLLAPSE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const BODY_IN_MS = 220;
const BODY_IN_DELAY_MS = 140;
const SHADOW_IN_MS = 160;
const SHADOW_IN_DELAY_MS = 260;
/** 收起时内容与软影同时淡掉，不等外形。 */
const FADE_OUT_MS = 60;
const GHOST_MS = 100;
/** 收起时副本在外形缩到一半多时才开始浮现，到收完恰好 100ms。 */
const GHOST_RETURN_DELAY_MS = 110;
const GHOST_BLUR_PX = 4;

/**
 * 弹簧位移曲线采样成 linear()，约 0.48s 到位：衰减 18、角频率 √96，等效刚度 420、阻尼 36。
 * 取设计稿脚本里的公式；稿里文字写的 340 / 32 与它自己的公式对不上，以公式为准。
 */
function springEasing() {
	const settle = EXPAND_MS / 1000;
	const omega = Math.sqrt(96);
	const samples = Array.from({ length: 30 }, (_, index) => {
		const time = (index / 29) * settle;
		if (time <= 0) return 0;
		if (time >= settle) return 1;
		const wave = Math.cos(omega * time) + (18 / omega) * Math.sin(omega * time);
		return Number((1 - Math.exp(-18 * time) * wave).toFixed(4));
	});
	return `linear(${samples.join(",")})`;
}

const px = (value: number) => `${Math.round(value * 100) / 100}px`;

/** `shape` 在 `within` 里的 clip-path inset。 */
function inset(shape: Box, within: Box, radius: number) {
	const right = within.left + within.width - (shape.left + shape.width);
	const bottom = within.top + within.height - (shape.top + shape.height);
	return `inset(${px(shape.top - within.top)} ${px(right)} ${px(bottom)} ${px(shape.left - within.left)} round ${px(radius)})`;
}

/** 浏览器序列化出的数：弹簧过冲时内缩为负，极小的值会写成科学计数法。 */
const NUMBER = String.raw`(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)`;
const INSET = new RegExp(
	String.raw`^inset\(${NUMBER}px ${NUMBER}px ${NUMBER}px ${NUMBER}px round ${NUMBER}px\)$`,
);

/** 解析 `inset(上 右 下 左 round 圆角)`，单位 px；不是这个形状时返回 null。 */
function parseInset(clip: string) {
	const match = INSET.exec(clip);
	return match ? match.slice(1).map(Number) : null;
}

/** 触发器的外形：胶囊或圆钮，圆角取短边的一半。 */
export function shapeOf(element: HTMLElement): Shape {
	const rect = element.getBoundingClientRect();
	return {
		left: rect.left,
		top: rect.top,
		width: rect.width,
		height: rect.height,
		radius: Math.min(rect.width, rect.height) / 2,
		background: getComputedStyle(element).backgroundColor,
	};
}

/** 透明的底色长不出外形：先露出背后的页面，改用面板自己的底色。 */
function opaque(color: string, fallback: string) {
	return color === "" || color === "transparent" || /(?:,|\/)\s*0\)$/.test(color)
		? fallback
		: color;
}

const opacityOf = (element: HTMLElement) =>
	Number.parseFloat(getComputedStyle(element).opacity) || 0;

/** 副本越透明越模糊，打断时两者一起从当前值继续。 */
const blurOf = (opacity: number) => `blur(${px((1 - opacity) * GHOST_BLUR_PX)})`;

/** 能否播放外形动画：需要 Web Animations，且没有开启减弱动态。 */
export function canMorph(element: HTMLElement) {
	if (typeof element.animate !== "function") return false;
	return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 外形、内容与软影各走各的时间；打断时读取当前的计算值作为新动画的起点，不跳回起点。
 */
export function createMorph({ panel, shadow, body, ghost, radius }: MorphParts): Morph {
	const resting = getComputedStyle(panel).backgroundColor;
	const full = `inset(0px 0px 0px 0px round ${px(radius)})`;
	const spring =
		typeof CSS !== "undefined" && CSS.supports?.("animation-timing-function", "linear(0, 1)")
			? springEasing()
			: COLLAPSE_EASE;
	let tracks: Animation[] = [];
	let lead: Animation | null = null;

	const live = () => lead !== null && lead.playState !== "finished" && lead.playState !== "idle";

	function play(target: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
		const animation = target.animate(frames, { fill: "both", ...options });
		animation.finished.catch(() => {});
		tracks.push(animation);
		return animation;
	}

	function stop() {
		for (const animation of tracks) animation.cancel();
		tracks = [];
		lead = null;
	}

	/** 播放中取动画当前的插值，静止时就是展开后的终态。 */
	function current() {
		if (!live()) return { clip: full, background: resting, body: 1, shadow: 1, ghost: 0 };
		const style = getComputedStyle(panel);
		return {
			clip: style.clipPath,
			background: style.backgroundColor,
			body: opacityOf(body),
			shadow: opacityOf(shadow),
			ghost: ghost ? opacityOf(ghost.element) : 0,
		};
	}

	return {
		expand(from) {
			const now = live() ? current() : null;
			const box = panel.getBoundingClientRect();
			stop();
			const startClip = now ? now.clip : from ? inset(from, box, from.radius) : full;
			const startColor = now
				? now.background
				: from
					? opaque(from.background, resting)
					: resting;
			lead = play(
				panel,
				[
					{ clipPath: startClip, backgroundColor: startColor },
					{ clipPath: full, backgroundColor: resting },
				],
				{ duration: EXPAND_MS, easing: spring, fill: "backwards" },
			);
			if (ghost) {
				const start = now ? now.ghost : 1;
				play(
					ghost.element,
					[
						{ opacity: start, filter: blurOf(start) },
						{ opacity: 0, filter: blurOf(0) },
					],
					{ duration: GHOST_MS, easing: "ease-out" },
				);
			}
			play(body, [{ opacity: now ? now.body : 0 }, { opacity: 1 }], {
				duration: BODY_IN_MS,
				delay: now ? 0 : BODY_IN_DELAY_MS,
				easing: "ease-out",
			});
			play(shadow, [{ opacity: now ? now.shadow : 0 }, { opacity: 1 }], {
				duration: SHADOW_IN_MS,
				delay: now ? 0 : SHADOW_IN_DELAY_MS,
				easing: "ease-out",
			});
		},

		collapse(to, done) {
			const now = current();
			const box = panel.getBoundingClientRect();
			stop();
			const collapsing = play(
				panel,
				[
					{ clipPath: now.clip, backgroundColor: now.background },
					{
						clipPath: inset(to, box, to.radius),
						backgroundColor: opaque(to.background, resting),
					},
				],
				{ duration: COLLAPSE_MS, easing: COLLAPSE_EASE, fill: "forwards" },
			);
			lead = collapsing;
			play(body, [{ opacity: now.body }, { opacity: 0 }], {
				duration: FADE_OUT_MS,
				easing: "ease-out",
			});
			play(shadow, [{ opacity: now.shadow }, { opacity: 0 }], {
				duration: FADE_OUT_MS,
				easing: "ease-out",
			});
			if (ghost?.returns) {
				play(
					ghost.element,
					[
						{ opacity: now.ghost, filter: blurOf(now.ghost) },
						{ opacity: 1, filter: blurOf(1) },
					],
					{ duration: GHOST_MS, delay: GHOST_RETURN_DELAY_MS, easing: "ease-out" },
				);
			}
			collapsing.finished.then(done, () => {});
		},

		shape() {
			const box = panel.getBoundingClientRect();
			const style = live() ? getComputedStyle(panel) : null;
			const [top, right, bottom, left, round] = (style && parseInset(style.clipPath)) || [
				0,
				0,
				0,
				0,
				radius,
			];
			return {
				left: box.left + left,
				top: box.top + top,
				width: box.width - left - right,
				height: box.height - top - bottom,
				radius: round,
				background: style ? style.backgroundColor : resting,
			};
		},

		dispose: stop,
	};
}
