import { useTheme } from "next-themes";
import { useCallback, useEffect } from "react";

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

const RIPPLE_DURATION = 500;
const RIPPLE_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

/**
 * animateThemeRipple - 围绕一次主题 DOM 变更跑圆形扩散动画
 *
 * 实现（Chrome 团队文档推荐的可靠模式）：
 * 1. document.startViewTransition(apply) — 浏览器抓 apply 前后两帧。
 * 2. transition.ready resolve 后，对 ::view-transition-new(root) 伪元素用
 *    Web Animations API 跑 clip-path circle，从原点 0 半径展开到最远角。
 * 3. 旧帧默认在底层、新帧从其上圆形揭开 → 无瞬时跳变（不闪）。
 *
 * apply 负责真正的 DOM 变更（手动切换走 setTheme，跟随系统走直接改 class）。
 * 不支持 VT 的浏览器（如 Firefox）或 VT 异常时降级为直接 apply，瞬时切换。
 */
export function animateThemeRipple(origin: RippleOrigin, apply: () => void): void {
    if (!supportsViewTransitions()) {
        apply();
        return;
    }

    const { px, py } = origin;
    // 圆形扩散终点半径 = 原点到视口四角的最大距离（保证覆盖整屏）
    const endRadius = Math.hypot(
        Math.max(px, window.innerWidth - px),
        Math.max(py, window.innerHeight - py),
    );

    const transition = document.startViewTransition(() => apply());

    // ready 后用 WAAPI 驱动 ::view-transition-new(root) 的 clip-path 扩散
    transition.ready
        .then(() => {
            document.documentElement.animate(
                {
                    clipPath: [
                        `circle(0px at ${px}px ${py}px)`,
                        `circle(${endRadius}px at ${px}px ${py}px)`,
                    ],
                },
                {
                    duration: RIPPLE_DURATION,
                    easing: RIPPLE_EASING,
                    // 关键：把动画作用到 VT 新帧伪元素上
                    pseudoElement: "::view-transition-new(root)",
                },
            );
        })
        .catch(() => apply());

    // 兜底：VT 异常 finished reject 时确保仍切完
    transition.finished.catch(() => apply());
}

/**
 * useThemeTransition - 包裹 next-themes.setTheme，叠加 View Transitions 圆形扩散
 *
 * 点击点像素坐标缺省居中。不改 next-themes 的 class 注入与 cookie 行为（保留架构）。
 */
export function useThemeTransition() {
    const { theme, setTheme } = useTheme();

    const toggle = useCallback(
        (ev?: { clientX?: number; clientY?: number }) => {
            const targetTheme = theme === "dark" ? "light" : "dark";
            const px = ev?.clientX ?? window.innerWidth / 2;
            const py = ev?.clientY ?? window.innerHeight / 2;
            animateThemeRipple({ px, py }, () => setTheme(targetTheme));
        },
        [theme, setTheme],
    );

    return { toggle, theme };
}

/**
 * applyThemeClass - 镜像 next-themes 在 attribute="class"、无 value 映射时的行为
 *
 * next-themes 会 remove 掉 light/dark 再 add 上当前解析值，因此 <html> 始终
 * 带 class="light" 或 class="dark"。跟随系统路径要复刻这个写法，避免类名
 * 与 next-themes 内部状态不一致。
 */
function applyThemeClass(resolved: "light" | "dark"): void {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
}

/**
 * useSystemThemeTransition - 跟随系统模式下，OS 切换暗/亮时叠加圆形扩散
 *
 * 根因：theme === 'system' 时，OS 切换由 next-themes 自己监听
 * prefers-color-scheme 并在其回调里同步直接改 <html> 的 class，绕过了
 * 任何 startViewTransition 包装，因此默认无扩散动画。
 *
 * 本 hook 只在 'system' 模式启用，监听同一个 media query 的 change：
 * next-themes 的监听器先注册、先触发，等本回调运行时 DOM 已是新主题；
 * 于是先同步还原成旧主题（此时无 paint），再让 startViewTransition 抓
 * 旧帧、回调里设回新主题抓新帧，从而驱动扩散。原点取视口中心。
 *
 * 依赖 next-themes 在 media change 时只同步改一次 class、不通过副作用
 * 二次重放（已核对其 0.x 实现）；升级 next-themes 时需复查此假设。
 * 不支持 VT 的浏览器放任 next-themes 瞬切，不画蛇添足。
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
            const newResolved = e.matches ? "dark" : "light";
            const oldResolved = newResolved === "dark" ? "light" : "dark";

            // 先还原旧帧，让 startViewTransition 抓到 旧→新 的两帧
            applyThemeClass(oldResolved);

            animateThemeRipple(
                {
                    px: window.innerWidth / 2,
                    py: window.innerHeight / 2,
                },
                () => applyThemeClass(newResolved),
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
 */
export function SystemThemeTransition(): null {
    useSystemThemeTransition();
    return null;
}
