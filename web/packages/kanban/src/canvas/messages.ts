import { formatMessage, type Locale } from "../locale.ts";

/**
 * 画布的可覆盖文案。
 *
 * {percent} 替换为缩放百分比，纯文本。
 */
export interface CanvasMessages {
	/** 画布视口的可访问名称。 */
	canvasLabel: string;
	/** 画布操作说明，关联到视口。 */
	canvasHint: string;
	/** 控件条的可访问名称。 */
	controlsLabel: string;
	zoomIn: string;
	zoomOut: string;
	fit: string;
	enterFullscreen: string;
	exitFullscreen: string;
	/**
	 * 缩放后的播报。
	 * @example "Zoom {percent}%"
	 */
	zoomStatus: string;
	/** 进入全屏后的播报，告诉用户怎么退出。 */
	fullscreenEntered: string;
	/** 退出全屏后的播报。 */
	fullscreenExited: string;
}

const messagesByLocale: Record<Locale, CanvasMessages> = {
	en: {
		canvasLabel: "Canvas",
		canvasHint:
			"Drag the background or use the arrow keys to pan. Hold Ctrl or ⌘ and scroll, or press + and −, to zoom. Press 0 to fit the window.",
		controlsLabel: "Canvas controls",
		zoomIn: "Zoom in",
		zoomOut: "Zoom out",
		fit: "Fit to window",
		enterFullscreen: "Enter full screen",
		exitFullscreen: "Exit full screen",
		zoomStatus: "Zoom {percent}%",
		fullscreenEntered: "Full screen. Press Escape to exit.",
		fullscreenExited: "Exited full screen.",
	},
	"zh-CN": {
		canvasLabel: "画布",
		canvasHint:
			"拖动背景或用方向键平移，按住 Ctrl 或 ⌘ 滚动滚轮、或按 + 与 - 缩放，按 0 适应窗口。",
		controlsLabel: "画布控制",
		zoomIn: "放大",
		zoomOut: "缩小",
		fit: "适应窗口",
		enterFullscreen: "进入全屏",
		exitFullscreen: "退出全屏",
		zoomStatus: "缩放 {percent}%",
		fullscreenEntered: "已全屏，按 Esc 退出。",
		fullscreenExited: "已退出全屏。",
	},
};

/** 取指定语言的内置文案，再用 `overrides` 中给出的键覆盖。 */
export function resolveCanvasMessages(
	locale: Locale = "en",
	overrides?: Partial<CanvasMessages>,
): CanvasMessages {
	return { ...(messagesByLocale[locale] ?? messagesByLocale.en), ...overrides };
}

export const zoomStatusText = (messages: CanvasMessages, scale: number) =>
	formatMessage(messages.zoomStatus, { percent: Math.round(scale * 100) });
