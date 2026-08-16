import { useTheme } from "next-themes";
import { useEffect } from "react";
import { runThemeRerender, type TargetTheme } from "@/shared/lib/theme-rerender";

/** 过渡原点（百分比，0..100） */
export interface TransitionOrigin {
	x: number;
	y: number;
}

export interface ViewportSize {
	w: number;
	h: number;
}

/**
 * resolveTransitionOrigin - 把点击事件换算为百分比坐标
 *
 * 导出为纯函数便于单测：无 DOM 副作用，只算数学。
 */
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

// 扩散动画由 CSS 声明（styles.css :active-view-transition-type(theme) 的
// theme-ripple，0.4s ease-out——对齐 yggdrasil 基准），JS 只注入坐标变量。

/**
 * animateThemeRipple - 围绕一次主题 DOM 变更跑圆形扩散动画
 *
 * 实现：
 * 1. document.startViewTransition({ types: ["theme"], update }) — 浏览器抓
 *    apply 前后两帧；update 里 apply 后强制 reflow，保证新快照是最终颜色。
 * 2. 扩散动画是纯 CSS（theme type 作用域的 theme-ripple keyframes），ready
 *    后即刻开播，无 WAAPI 注册竞态；new 帧压顶层且带不透明背景防透叠。
 * 3. transition.finished 后 runThemeRerender(target) 统一重渲图块——
 *    mermaid v11 渲染依赖被 VT 暂停的帧调度，放 update 回调里会死锁，
 *    且动画期间的 mermaid DOM 写入会把 VT 动画拖住（实测 finished 从
 *    ~500ms 拖到 9.5s），故图块以旧色参与动画，结束后 ~400ms 换新色。
 *
 * apply 负责真正的 DOM 变更（手动切换走同步 class 翻转，跟随系统走直接改 class）。
 * target 显式传目标主题：next-themes setTheme 只 setState，<html> class 变更
 * 落在 React effect，update 回调执行时 classList 还是旧主题，订阅方读不到。
 * 不支持 VT 的浏览器（如 Firefox）、reduced-motion 或 VT 异常时降级为直接 apply，瞬时切换。
 */
export function animateThemeRipple(
	origin: RippleOrigin,
	apply: () => void,
	target: TargetTheme,
): ViewTransition | null {
	// 降级/兜底路径统一走这里：apply 后手动驱动重渲（VT 路径由 update 回调 await）
	const applyAndRerender = () => {
		apply();
		void runThemeRerender(target);
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

	// theme-vt（view-transition-name:none）持续到 finished；theme-vt-freeze
	// （transition:none）只需持续到 ready——抓帧完成后新 transition 与主题切换
	// 无关，应正常播放，避免 VT 窗口内元素加载/淡入被压制（实测阻塞感主因）。
	const root = document.documentElement;
	root.classList.add("theme-vt", "theme-vt-freeze");
	// 扩散坐标交给 CSS keyframes（theme-ripple）
	root.style.setProperty("--theme-ripple-x", `${px}px`);
	root.style.setProperty("--theme-ripple-y", `${py}px`);
	root.style.setProperty("--theme-ripple-r", `${endRadius}px`);

	// mermaid v11 渲染依赖被 VT 暂停的帧调度，在 update 回调里 await 会死锁
	// （实测单图渲染都跑不完）。故 update 只做同步 apply + 强制 reflow
	// （保证新快照抓到最终颜色，而非过渡中间态），图块以旧色参与扩散，
	// finished 后统一重渲换新色。
	const transition = document.startViewTransition({
		types: ["theme"],
		update: () => {
			apply();
			getComputedStyle(document.body).backgroundColor;
		},
	});

	// ready：帧已捕获，解除 transition 冻结（VT 伪元素动画独立于真实 DOM）
	transition.ready
		.then(() => {
			root.classList.remove("theme-vt-freeze");
		})
		.catch(() => {
			root.classList.remove("theme-vt", "theme-vt-freeze");
			applyAndRerender();
		});

	// 动画结束后统一重渲图块；VT 异常时走兜底确保仍切完。
	// 必须先移除 theme-vt 再渲染：其全文档 view-transition-name:none 规则会让
	// mermaid 测量用临时 div 的插入触发全文档样式重算，13 图并发时崩。
	transition.finished
		.then(() => {
			root.classList.remove("theme-vt");
			root.style.removeProperty("--theme-ripple-x");
			root.style.removeProperty("--theme-ripple-y");
			root.style.removeProperty("--theme-ripple-r");
			return runThemeRerender(target);
		})
		.catch(() => {
			root.classList.remove("theme-vt");
			root.style.removeProperty("--theme-ripple-x");
			root.style.removeProperty("--theme-ripple-y");
			root.style.removeProperty("--theme-ripple-r");
			applyAndRerender();
		});

	return transition;
}

/**
 * applyThemeClass - 镜像 next-themes 在 attribute="class"、无 value 映射时的行为
 *
 * next-themes 会 remove 掉 light/dark 再 add 上当前解析值，因此 <html> 始终
 * 带 class="light" 或 class="dark"。跟随系统路径要复刻这个写法，避免类名
 * 与 next-themes 内部状态不一致。
 */
export function applyThemeClass(resolved: "light" | "dark"): void {
	const root = document.documentElement;
	root.classList.remove("light", "dark");
	root.classList.add(resolved);
}

/**
 * useSystemThemeTransition - 跟随系统模式下，OS 切换暗/亮时叠加圆形扩散
 *
 * next-themes 0.4.x 监听 prefers-color-scheme 变化后只 setResolvedTheme
 * （React state），<html> class 变更异步发生在后续 React commit，且它用
 * 已废弃的 addListener（与我们的 addEventListener 各自独立触发）。故本 hook
 * 自行监听同一个 media query：回调触发时读当前 <html> class 推断旧主题，
 * 直接驱动 VT（旧帧 → apply 新主题 → 扩散），不依赖 next-themes 的 DOM 时序。
 * 不支持 VT 的浏览器放任 next-themes 自行切换，不画蛇添足。
 */
export function useSystemThemeTransition(): void {
	const { theme } = useTheme();

	useEffect(() => {
		if (theme !== "system") {
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
			const newResolved: TargetTheme = e.matches ? "dark" : "light";
			// 从当前 <html> class 读旧主题（next-themes 可能已/未改，以实际 DOM 为准）
			const oldResolved: TargetTheme = document.documentElement.classList.contains("dark")
				? "dark"
				: "light";
			// 旧新相同（next-themes 已先行改完或未变）则无需动画
			if (oldResolved === newResolved) {
				return;
			}
			// 确保旧帧就位（next-themes 异步改 class，此处同步锁定为旧值）
			applyThemeClass(oldResolved);
			animateThemeRipple(
				{ px: window.innerWidth / 2, py: window.innerHeight / 2 },
				() => applyThemeClass(newResolved),
				newResolved,
			);
		};

		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, [theme]);
}

/**
 * SystemThemeTransition - 全局挂载用空组件
 *
 * 必须渲染在 ThemeProvider 内部才能拿到 useTheme；在 __root 的 AppProvider
 * 子树里挂一个即可让任意页面 OS 切换都触发扩散。
 *
 * 另同步 resolvedTheme → cookie（"light"/"dark"），供 SSR 读 cookie 给 <html>
 * 设正确 class 防 FOUC。覆盖所有场景：显式切换、system 模式 OS 切换、首次 mount。
 */
export function SystemThemeTransition(): null {
	useSystemThemeTransition();
	const { resolvedTheme } = useTheme();
	useEffect(() => {
		if (resolvedTheme === "light" || resolvedTheme === "dark") {
			cookieStore.set({
				name: "theme",
				value: resolvedTheme,
				path: "/",
				sameSite: "lax",
				// CookieInit 无 maxAge 字段，用 expires（epoch ms）等价 max-age=31536000s（1 年）
				expires: Date.now() + 31536000_000,
			});
		}
	}, [resolvedTheme]);
	return null;
}
