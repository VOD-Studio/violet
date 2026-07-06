import { Monitor, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import type { ThemeOption } from "./types";
import { useThemeSwitcher } from "./use-theme-switcher";

const choices: { value: ThemeOption; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "亮色", icon: Sun },
    { value: "dark", label: "暗色", icon: Moon },
    { value: "system", label: "系统", icon: Monitor },
];

/**
 * SegmentedToggle - 三段胶囊拨动开关
 *
 * 三个等分格排成一行，滑块用 layoutId 平滑跟随当前主题。
 * 点击任一格子切换到对应主题，配合 useThemeSwitcher 的圆形扩散动画。
 */
export function SegmentedToggle() {
    const { theme, switchTheme } = useThemeSwitcher();

    return (
        <div
            className="relative inline-flex items-center rounded-full border border-border bg-muted p-1"
            role="radiogroup"
            aria-label="主题切换"
        >
            {choices.map((choice) => {
                const isActive = theme === choice.value;
                const Icon = choice.icon;

                return (
                    <button
                        key={choice.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={(e) =>
                            switchTheme(choice.value, {
                                clientX: e.clientX,
                                clientY: e.clientY,
                            })
                        }
                        className="group relative z-10 flex h-9 w-16 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        {isActive && (
                            <motion.div
                                layoutId="segmented-active"
                                className="absolute inset-0 rounded-full bg-background shadow-sm"
                                transition={{
                                    type: "spring",
                                    stiffness: 380,
                                    damping: 30,
                                }}
                            />
                        )}
                        <Icon
                            className={`relative z-10 size-4 transition-opacity duration-200 ${
                                isActive
                                    ? "text-foreground"
                                    : "text-muted-foreground group-hover:text-foreground/80"
                            }`}
                        />
                        <span className="sr-only">{choice.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
