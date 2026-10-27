import { persistAppearanceCookie } from "@shared/lib/appearance-cookie";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { runAppearanceRerender, type TargetAppearance } from "@/shared/lib/appearance-rerender";

/** 过渡原点（百分比，0..100） */
export interface TransitionOrigin {
	x: number;
	y: number;
}

export interface ViewportSize {
	w: number;
	h: number;
}

/** 将点击位置换算为视口百分比；缺失坐标时使用视口中心。 */
export function resolveTransitionOrigin(
	ev: MouseEvent | { clientX?: number; clientY?: number },
	vp: ViewportSize,
): TransitionOrigin {
	const x = ev.clientX ?? vp.w / 2;
	const y = ev.clientY ?? vp.h / 2;
	return {
		x: vp.w > 0 ? Math.max(0, Math.min(100, (x / vp.w) * 100)) : 50,
		y: vp.h > 0 ? Math.max(0, Math.min(100, (y / vp.h) * 100)) : 50,
	};
}

/**
 * 是否支持 View Transitions API（运行时探测，SSR 安全）。
 *
 * TS DOM lib 已类型化 startViewTransition，但 Firefox 等浏览器运行时尚无此 API，
 * 因此仍需在调用前做运行时探测。
 */
function supportsViewTransitions(): boolean {
	return typeof document !== "undefined" && "startViewTransition" in document;
}

/** 扩散动画的像素原点 */
interface RippleOrigin {
	px: number;
	py: number;
}

/**
 * 围绕同步明暗变更播放圆形扩散，动画结束后统一重渲图块。
 *
 * @remarks apply 必须同步更新 DOM；目标明暗显式传入，不等待 next-themes 的 effect。
 * 不支持 View Transition、减少动态效果或动画失败时直接切换。
 */
export function animateAppearanceRipple(
	origin: RippleOrigin,
	apply: () => void,
	target: TargetAppearance,
): ViewTransition | null {
	// 无动画或动画失败时，更新 DOM 后立即通知订阅者。
	const applyAndRerender = () => {
		apply();
		void runAppearanceRerender(target);
	};

	if (!supportsViewTransitions()) {
		applyAndRerender();
		return null;
	}

	// reduced-motion：不做扩散，直接切（WCAG）
	if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
		applyAndRerender();
		return null;
	}

	const { px, py } = origin;
	// 圆形扩散终点半径 = 原点到视口四角的最大距离（保证覆盖整屏）
	const endRadius = Math.hypot(
		Math.max(px, window.innerWidth - px),
		Math.max(py, window.innerHeight - py),
	);

	// 命名组抑制持续到 finished；CSS transition 冻结只持续到 ready，避免阻塞后续淡入。
	const root = document.documentElement;
	root.classList.add("appearance-vt", "appearance-vt-freeze");
	// 扩散坐标交给 transitions.css 的圆形扩散动画。
	root.style.setProperty("--appearance-ripple-x", `${px}px`);
	root.style.setProperty("--appearance-ripple-y", `${py}px`);
	root.style.setProperty("--appearance-ripple-r", `${endRadius}px`);

	// update 只同步切换并强制重算颜色；图块依赖帧调度，必须等 finished 后再渲染。
	const transition = document.startViewTransition({
		types: ["appearance"],
		update: () => {
			apply();
			getComputedStyle(document.body).backgroundColor;
		},
	});

	// ready：帧已捕获，解除 transition 冻结（VT 伪元素动画独立于真实 DOM）
	transition.ready
		.then(() => {
			root.classList.remove("appearance-vt-freeze");
		})
		.catch(() => {
			root.classList.remove("appearance-vt", "appearance-vt-freeze");
			applyAndRerender();
		});

	// 先解除全文档命名组抑制，再渲染图块，避免测量节点触发额外样式重算。
	transition.finished
		.then(() => {
			root.classList.remove("appearance-vt");
			root.style.removeProperty("--appearance-ripple-x");
			root.style.removeProperty("--appearance-ripple-y");
			root.style.removeProperty("--appearance-ripple-r");
			return runAppearanceRerender(target);
		})
		.catch(() => {
			root.classList.remove("appearance-vt");
			root.style.removeProperty("--appearance-ripple-x");
			root.style.removeProperty("--appearance-ripple-y");
			root.style.removeProperty("--appearance-ripple-r");
			applyAndRerender();
		});

	return transition;
}

/** 同步更新明暗 class，与 next-themes 的 attribute="class" 行为保持一致。 */
export function applyAppearanceClass(resolved: "light" | "dark"): void {
	const root = document.documentElement;
	root.classList.remove("light", "dark");
	root.classList.add(resolved);
}

/**
 * 跟随系统时，从当前 DOM 明暗状态启动扩散，不依赖 next-themes 的异步 class 更新。
 */
export function useSystemAppearanceTransition(): void {
	const { theme: appearance } = useTheme();

	useEffect(() => {
		if (appearance !== "system") {
			return;
		}
		if (typeof window === "undefined" || !window.matchMedia) {
			return;
		}
		if (!supportsViewTransitions()) {
			return;
		}

		const mq = window.matchMedia("(prefers-color-scheme: dark)");

		const onChange = (e: MediaQueryListEvent) => {
			const newResolved: TargetAppearance = e.matches ? "dark" : "light";
			// 以实际 DOM 为准，next-themes 可能已先行更新明暗。
			const oldResolved: TargetAppearance = document.documentElement.classList.contains(
				"dark",
			)
				? "dark"
				: "light";
			// 旧新相同（next-themes 已先行改完或未变）则无需动画
			if (oldResolved === newResolved) {
				return;
			}
			// 确保旧帧就位（next-themes 异步改 class，此处同步锁定为旧值）
			applyAppearanceClass(oldResolved);
			animateAppearanceRipple(
				{ px: window.innerWidth / 2, py: window.innerHeight / 2 },
				() => applyAppearanceClass(newResolved),
				newResolved,
			);
		};

		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, [appearance]);
}

/** 挂载于 ThemeProvider 内，处理系统明暗过渡并同步 SSR 使用的 appearance cookie。 */
export function SystemAppearanceTransition(): null {
	useSystemAppearanceTransition();
	const { resolvedTheme: resolvedAppearance } = useTheme();
	useEffect(() => {
		if (resolvedAppearance === "light" || resolvedAppearance === "dark") {
			persistAppearanceCookie(resolvedAppearance);
		}
	}, [resolvedAppearance]);
	return null;
}
