import { useIsDarkAppearance } from "@shared/lib/dark-appearance";
import { useReducedMotion } from "@shared/lib/motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useKnockWindow, useWindowState } from "../api/queries";
import { isWindowBlank } from "../lib/blank";
import { createWindowEngine, type WindowEngine } from "../lib/engine";
import type { WindowCondition, WindowState } from "../model/types";

import styles from "./WindowBackdrop.module.css";

/** 两次轻点算一次敲窗的最长间隔与最大距离 */
const KNOCK_MS = 380;
const KNOCK_PX = 24;
/** 敲窗卡片停留时长 */
const CARD_MS = 5200;

const CONDITION_TEXT: Record<WindowCondition, string> = {
	clear: "晴",
	cloudy: "多云",
	fog: "有雾",
	rain: "下雨",
	snow: "下雪",
	storm: "雷雨",
	"": "天气暂时看不到",
};

function describeThere(state: WindowState | undefined): string {
	if (!state?.enabled) return "站长还没告诉窗外是哪座城市。";
	const time = new Intl.DateTimeFormat("zh-CN", {
		timeZone: state.timezone,
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date());
	const temp = state.temperature_c === null ? "" : ` ${Math.round(state.temperature_c)}°`;
	return `他那边 ${time}，${state.city}，${CONDITION_TEXT[state.condition]}${temp}。`;
}

export interface WindowBackdropProps {
	/** 阅读页：雾更浓，水珠只出现在正文栏两侧 */
	dense: boolean;
	/** 站长正在听的歌，显示在敲窗卡片里；null 表示没在听 */
	listening: string | null;
}

/**
 * 全站背景「窗」：隔着起雾的玻璃看站长那边此刻的天气。
 * 在空白处按住拖动擦雾，连点两下敲窗。
 *
 * @remarks 四层画布须放在 fixed 铺满视口、pointer-events: none 的背景容器内；
 * 指针交互在 window 上监听，只响应 isWindowBlank 判定为空白的落点。
 */
export function WindowBackdrop({ dense, listening }: WindowBackdropProps) {
	const { data } = useWindowState();
	const { mutate: knockRemote } = useKnockWindow();
	const dark = useIsDarkAppearance();
	const still = useReducedMotion();
	const viewRef = useRef<HTMLCanvasElement>(null);
	const outRef = useRef<HTMLCanvasElement>(null);
	const fogRef = useRef<HTMLCanvasElement>(null);
	const glassRef = useRef<HTMLCanvasElement>(null);
	const engineRef = useRef<WindowEngine | null>(null);
	const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
	const [cardAt, setCardAt] = useState(0);

	useEffect(() => {
		const view = viewRef.current;
		const out = outRef.current;
		const fog = fogRef.current;
		const glass = glassRef.current;
		if (!view || !out || !fog || !glass) return undefined;
		const engine = createWindowEngine({ view, out, fog, glass });
		engineRef.current = engine;
		let timer = 0;
		const onResize = () => {
			window.clearTimeout(timer);
			timer = window.setTimeout(() => engine.resize(), 150);
		};
		const onVisibility = () => engine.setPaused(document.hidden);
		window.addEventListener("resize", onResize);
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			window.clearTimeout(timer);
			window.removeEventListener("resize", onResize);
			document.removeEventListener("visibilitychange", onVisibility);
			engine.destroy();
			engineRef.current = null;
		};
	}, []);

	const photoUrl = data?.photo ?? "";
	useEffect(() => {
		if (!photoUrl) {
			setPhoto(null);
			return undefined;
		}
		const img = new Image();
		img.decoding = "async";
		img.onload = () => setPhoto(img);
		img.onerror = () => setPhoto(null);
		img.src = photoUrl;
		return () => {
			img.onload = null;
			img.onerror = null;
		};
	}, [photoUrl]);

	useEffect(() => {
		engineRef.current?.setScene({
			condition: data?.condition || "cloudy",
			slot: data?.photo_slot ?? "cloudy",
			isDay: data?.is_day ?? true,
			dark,
			dense,
			still,
			photo,
		});
	}, [data?.condition, data?.photo_slot, data?.is_day, dark, dense, still, photo]);

	const knock = useCallback(() => {
		engineRef.current?.knock();
		setCardAt(Date.now());
		knockRemote(window.location.pathname);
	}, [knockRemote]);

	useEffect(() => {
		let wiping: { id: number; x: number; y: number } | null = null;
		let tap = { t: 0, x: 0, y: 0 };
		const onDown = (e: PointerEvent) => {
			if (e.button !== 0 || !isWindowBlank(e.target)) return;
			const now = performance.now();
			if (
				now - tap.t < KNOCK_MS &&
				Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < KNOCK_PX
			) {
				tap = { t: 0, x: 0, y: 0 };
				knock();
				return;
			}
			tap = { t: now, x: e.clientX, y: e.clientY };
			// 触屏上的拖动留给滚动，只有鼠标和笔能擦雾
			if (e.pointerType === "mouse" || e.pointerType === "pen")
				wiping = { id: e.pointerId, x: e.clientX, y: e.clientY };
		};
		const onMove = (e: PointerEvent) => {
			if (!wiping || e.pointerId !== wiping.id) return;
			if (!(e.buttons & 1)) {
				wiping = null;
				return;
			}
			engineRef.current?.wipe(wiping.x, wiping.y, e.clientX, e.clientY);
			wiping.x = e.clientX;
			wiping.y = e.clientY;
			// 不在 pointerdown 上阻止默认行为（会让输入框点空白失焦失效），擦雾途中顺手清掉被拖出来的选区
			const sel = window.getSelection();
			if (sel && !sel.isCollapsed) sel.removeAllRanges();
		};
		const onUp = (e: PointerEvent) => {
			if (wiping && e.pointerId === wiping.id) wiping = null;
		};
		window.addEventListener("pointerdown", onDown, { passive: true });
		window.addEventListener("pointermove", onMove, { passive: true });
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
		return () => {
			window.removeEventListener("pointerdown", onDown);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
		};
	}, [knock]);

	useEffect(() => {
		if (!cardAt) return undefined;
		const timer = window.setTimeout(() => setCardAt(0), CARD_MS);
		return () => window.clearTimeout(timer);
	}, [cardAt]);

	return (
		<>
			<canvas
				ref={viewRef}
				className={`${styles.layer} ${styles.view}`}
				data-dark={dark ? "" : undefined}
			/>
			<canvas ref={outRef} className={styles.layer} />
			<canvas ref={fogRef} className={styles.layer} />
			<canvas ref={glassRef} className={styles.layer} />
			{cardAt > 0 &&
				createPortal(
					<div
						role="status"
						className="fixed top-20 right-4 z-40 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-surface-glass p-4 shadow-[0_4px_24px_rgb(0_0_0/0.05)] backdrop-blur-md animate-in fade-in dark:ring-1 dark:ring-border"
					>
						<p className="text-sm font-semibold">你敲了敲窗</p>
						<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
							{describeThere(data)}
						</p>
						{listening && (
							<p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
								{listening}
							</p>
						)}
					</div>,
					document.body,
				)}
		</>
	);
}
