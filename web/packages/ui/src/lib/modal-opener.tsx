import { useEffect, useLayoutEffect, useState } from "react";

/** 最近一次点击的元素；鼠标点击与键盘激活按钮都会派发 click，快捷键不会。 */
let lastClick: { target: Element; time: number } | undefined;
let listening = false;

/** 点击到打开之间可能隔着一次状态更新或请求，超过这个时长的点击不算打开它的。 */
const CLICK_WINDOW_MS = 1000;

const PRESSABLE = "button, a[href], [role='button']";

function rememberClick(event: MouseEvent) {
	if (event.target instanceof Element)
		lastClick = { target: event.target, time: event.timeStamp };
}

/** 在文档上登记点击监听；模态单元的根挂载时调用，多次调用只登记一次。 */
export function useTrackClicks() {
	useEffect(() => {
		if (listening) return;
		listening = true;
		document.addEventListener("click", rememberClick, true);
	}, []);
}

/** 打开浮层的两种线索。 */
export interface Opener {
	/** 刚被点击的按钮或链接；快捷键、系统提醒打开时为 null */
	clicked: HTMLElement | null;
	/** 关闭后归还焦点的元素：打开时的焦点；Safari 点按钮不给焦点，退回被点击的按钮 */
	focus: HTMLElement | null;
}

/** 此刻的打开者。 */
export function findOpener(): Opener {
	const recent =
		lastClick && performance.now() - lastClick.time < CLICK_WINDOW_MS
			? lastClick.target.closest<HTMLElement>(PRESSABLE)
			: null;
	const clicked = recent?.isConnected ? recent : null;
	const active = document.activeElement;
	const focus = active instanceof HTMLElement && active !== document.body ? active : clicked;
	return { clicked, focus };
}

/**
 * 打开的那一刻记下打开者。
 *
 * @remarks 渲染在浮层内容之前、随打开挂载：同一次提交里它的 layout effect 先于内容里的 autoFocus 执行。
 */
export function OpenerCapture({ onCapture }: { onCapture: (opener: Opener) => void }) {
	const [capture] = useState(() => onCapture);
	useLayoutEffect(() => capture(findOpener()), [capture]);
	return null;
}

/** 把焦点还给打开者；打开者已经不在文档里时什么也不做。 */
export function restoreFocus(opener: HTMLElement | null) {
	if (opener?.isConnected) opener.focus({ preventScroll: true });
}

/** 当前打开着的遮罩，按打开顺序排列。 */
const openScrims: object[] = [];

/**
 * 这一层遮罩是否叠在另一层之上：对话框上再开确认框时，遮罩不再加深。
 *
 * @param open - 遮罩所属浮层是否打开
 */
export function useStackedScrim(open: boolean): boolean {
	const [token] = useState(() => ({}));
	const [stacked, setStacked] = useState(false);
	useLayoutEffect(() => {
		if (!open) return;
		setStacked(openScrims.length > 0);
		openScrims.push(token);
		return () => {
			openScrims.splice(openScrims.indexOf(token), 1);
		};
	}, [open, token]);
	return open && stacked;
}

/** 浮层内容是否落在 Radix 的独立浮层里：框里的选择器、弹出层、菜单与文字提示点选不算点外面。 */
export function isInsideFloating(target: EventTarget | null): boolean {
	return (
		target instanceof Element &&
		target.closest(
			"[data-radix-popper-content-wrapper], [role=listbox], [data-radix-select-viewport], [data-radix-menu-content]",
		) !== null
	);
}
