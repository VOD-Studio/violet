import { useCallback } from "react";
import { useTheme } from "next-themes";

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
 */
function supportsViewTransitions(): boolean {
    return typeof document !== "undefined" && "startViewTransition" in document;
}

/** VT 带圆扩散动画的 transition 对象形态（TS DOM lib 尚未类型化） */
interface ViewTransition {
    ready: Promise<void>;
    finished: Promise<void>;
}

/**
 * useThemeTransition - 包裹 next-themes.setTheme，叠加 View Transitions 圆形扩散
 *
 * 实现（Chrome 团队文档推荐的可靠模式）：
 * 1. document.startViewTransition(() => setTheme(...)) — 浏览器抓切换前后两帧。
 * 2. transition.ready resolve 后，对 ::view-transition-new(root) 伪元素用
 *    Web Animations API（element.animate + pseudoElement 选项）跑 clip-path
 *    circle 从点击点 0 半径展开到最远角。
 * 3. 旧帧默认在底层、新帧从其上圆形揭开 → 无瞬时跳变（不闪）。
 *
 * 不支持 VT 的浏览器（如 Firefox）降级为瞬时切换。
 * 不改 next-themes 的 class 注入与 cookie 行为（保留架构）。
 */
export function useThemeTransition() {
    const { theme, setTheme } = useTheme();

    const toggle = useCallback(
        (ev?: { clientX?: number; clientY?: number }) => {
            const targetTheme = theme === "dark" ? "light" : "dark";

            // 不支持 VT：直接切（瞬时，无动画但不会卡住）
            if (!supportsViewTransitions()) {
                setTheme(targetTheme);
                return;
            }

            // 点击点像素坐标（缺省居中）
            const px = ev?.clientX ?? window.innerWidth / 2;
            const py = ev?.clientY ?? window.innerHeight / 2;
            // 圆形扩散终点半径 = 点击点到视口四角的最大距离（保证覆盖整屏）
            const endRadius = Math.hypot(
                Math.max(px, window.innerWidth - px),
                Math.max(py, window.innerHeight - py),
            );

            const docVT = document as Document & {
                startViewTransition?: (cb: () => void) => ViewTransition;
            };
            const transition = docVT.startViewTransition?.(() => {
                setTheme(targetTheme);
            });

            // VT 不可用：直接切
            if (!transition) {
                setTheme(targetTheme);
                return;
            }

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
                            duration: 500,
                            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
                            // 关键：把动画作用到 VT 新帧伪元素上
                            pseudoElement: "::view-transition-new(root)",
                        },
                    );
                })
                .catch(() => setTheme(targetTheme));

            // 兜底：VT 异常 finished reject 时确保仍切完
            transition.finished.catch(() => setTheme(targetTheme));
        },
        [theme, setTheme],
    );

    return { toggle, theme };
}
