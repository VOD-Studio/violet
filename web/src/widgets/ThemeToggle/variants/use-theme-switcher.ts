import { useTheme } from "next-themes";
import { useCallback } from "react";
import type { ThemeOption } from "./types";

/**
 * ViewTransition - startViewTransition 返回对象的轻量类型
 */
interface ViewTransition {
    ready: Promise<void>;
    finished: Promise<void>;
}

/**
 * ThemePointer - 触发切换时的指针坐标
 */
interface ThemePointer {
    clientX?: number;
    clientY?: number;
}

/**
 * supportsViewTransitions - 运行时探测 View Transitions API
 */
function supportsViewTransitions(): boolean {
    return typeof document !== "undefined" && "startViewTransition" in document;
}

/**
 * useThemeSwitcher - 支持 light / dark / system 三态的圆形扩散切换
 *
 * 封装 next-themes.setTheme，并在支持的浏览器里用 View Transitions
 * 从点击位置圆形揭开新主题。与 useThemeTransition 不同，这里接受
 * 任意目标主题，且仅在目标与当前显式设置不同时才执行动画。
 */
export function useThemeSwitcher() {
    const { theme, setTheme } = useTheme();

    const switchTheme = useCallback(
        (target: ThemeOption, pointer?: ThemePointer) => {
            if (theme === target) {
                return;
            }

            if (!supportsViewTransitions()) {
                setTheme(target);
                return;
            }

            const px = pointer?.clientX ?? window.innerWidth / 2;
            const py = pointer?.clientY ?? window.innerHeight / 2;
            const endRadius = Math.hypot(
                Math.max(px, window.innerWidth - px),
                Math.max(py, window.innerHeight - py),
            );

            const doc = document as Document & {
                startViewTransition?: (cb: () => void) => ViewTransition;
            };
            const transition = doc.startViewTransition?.(() => {
                setTheme(target);
            });

            if (!transition) {
                setTheme(target);
                return;
            }

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
                            pseudoElement: "::view-transition-new(root)",
                        },
                    );
                })
                .catch(() => setTheme(target));

            transition.finished.catch(() => setTheme(target));
        },
        [theme, setTheme],
    );

    return { theme: theme as ThemeOption | undefined, switchTheme };
}
