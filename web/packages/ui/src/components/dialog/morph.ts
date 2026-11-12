const EASE = "cubic-bezier(0.2, 0, 0.2, 1)";
const MORPH_ID = "v-dialog-morph";
const EXPAND_MS = 400;
const COLLAPSE_MS = 220;
const CONTENT_OUT_MS = 60; // 与 dialog.css 的内容淡出时长一致。
/** 收回按钮之后按钮上的字淡入的时长，与 dialog.css 的 v-dialog-origin-in 一致。 */
const ORIGIN_RETURN_MS = 120;

/** 只有按钮或链接能长成对话框；菜单项、选项随菜单一起消失，从它们展开没有来处。 */
const ORIGIN = "button, a[href], [role='button']";
const NOT_ORIGIN = "[role='menu'], [role='menubar'], [role='listbox'], [role='option']";

/**
 * 能作为展开来处的打开者：可见的按钮或链接。
 *
 * @returns 打开者本身，不合适时为 null
 */
export function morphOrigin(opener: HTMLElement | null): HTMLElement | null {
	if (!opener?.isConnected || !opener.matches(ORIGIN) || opener.closest(NOT_ORIGIN)) return null;
	const rect = opener.getBoundingClientRect();
	return rect.width > 0 && rect.height > 0 ? opener : null;
}

function reducedMotion() {
	return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function originBackground(style: CSSStyleDeclaration, panel: HTMLElement) {
	const color = style.backgroundColor;
	// 幽灵按钮没有底色，从透明长出来会先露出背后的页面，改从凹陷色开始。
	if (color === "transparent" || /(?:,|\/)\s*0\)$/.test(color)) {
		return getComputedStyle(panel).getPropertyValue("--muted").trim() || color;
	}
	return color;
}

/**
 * 从按钮长成对话框，或收回按钮：面板先按最终大小排好，只动位移与裁切，内容不缩放。
 *
 * @param panel - 已按最终大小布局的面板
 * @param origin - 打开它的按钮
 * @param back - true 为收回
 * @returns 正在播放的动画；不能播放（减弱动态、未布局、不支持 WAAPI）时为 null
 */
export function morph(panel: HTMLElement, origin: HTMLElement, back: boolean): Animation | null {
	if (typeof panel.animate !== "function" || reducedMotion()) return null;
	const playing = panel.getAnimations?.().filter((animation) => animation.id === MORPH_ID) ?? [];
	// 开发模式下 ref 回调会再执行一次：展开已在播放就沿用，否则会把按钮的底色量成面板的底色
	const expanding = playing.find((animation) => animation.playState === "running");
	if (!back && expanding) return expanding;
	const style = back && playing.length ? getComputedStyle(panel) : null;
	const current = style
		? {
				transform: style.transform,
				clipPath: style.clipPath,
				backgroundColor: style.backgroundColor,
				boxShadow: style.boxShadow,
			}
		: null;
	// 收回前取消残留的展开，量到的才是面板本来的位置与底色
	for (const animation of playing) animation.cancel();
	const from = origin.getBoundingClientRect();
	const to = panel.getBoundingClientRect();
	if (!from.width || !to.width) return null;
	const dx = Math.round(from.left + from.width / 2 - (to.left + to.width / 2));
	const dy = Math.round(from.top + from.height / 2 - (to.top + to.height / 2));
	const ix = Math.max(0, (to.width - from.width) / 2);
	const iy = Math.max(0, (to.height - from.height) / 2);
	const { backgroundColor: panelColor, boxShadow: panelShadow } = getComputedStyle(panel);
	const originStyle = getComputedStyle(origin);
	const noShadow = "0 4px 24px transparent";
	const button = {
		transform: `translate(${dx}px, ${dy}px)`,
		clipPath: `inset(${iy}px ${ix}px round ${originStyle.borderRadius})`,
		backgroundColor: originBackground(originStyle, panel),
		boxShadow: noShadow,
	};
	const flush = {
		transform: "translate(0px, 0px)",
		clipPath: "inset(0px 0px round 12px)",
		backgroundColor: panelColor,
		boxShadow: noShadow,
	};
	// 到位前最后一段放开裁切，软影才浮起来
	const free = {
		transform: "translate(0px, 0px)",
		clipPath: "inset(-40px -40px round 52px)",
		backgroundColor: panelColor,
		boxShadow: panelShadow === "none" ? noShadow : panelShadow,
	};
	// offset 表示实际时间；缓动放在各段，避免整段缓动把外形终点提前。
	const frames = back
		? [
				{ offset: 0, ...free, ...current, easing: "ease-out" },
				{
					offset: CONTENT_OUT_MS / COLLAPSE_MS,
					...(current ? { ...current, boxShadow: noShadow } : flush),
					easing: EASE,
				},
				{ offset: 1, ...button },
			]
		: [
				{ offset: 0, ...button, easing: EASE },
				{ offset: 0.86, ...flush, easing: "ease-out" },
				{ offset: 1, ...free },
			];
	return panel.animate(frames, {
		id: MORPH_ID,
		duration: back ? COLLAPSE_MS : EXPAND_MS,
		easing: "linear",
		fill: back ? "forwards" : "none",
	});
}

/** 对话框打开期间按钮本身就是对话框，把它藏起来；收回后按钮上的字再淡入。 */
export function hideOrigin(origin: HTMLElement) {
	origin.dataset.dialogOrigin = "hidden";
}

export function returnOrigin(origin: HTMLElement) {
	if (origin.dataset.dialogOrigin !== "hidden") return;
	origin.dataset.dialogOrigin = "returning";
	window.setTimeout(() => {
		if (origin.dataset.dialogOrigin === "returning") delete origin.dataset.dialogOrigin;
	}, ORIGIN_RETURN_MS);
}
