import { motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import type { ThemeOption } from "./types";
import { useThemeSwitcher } from "./use-theme-switcher";

const choices: { value: ThemeOption; label: string; icon: typeof Sun; color: string }[] = [
    { value: "light", label: "亮色", icon: Sun, color: "text-amber-500" },
    { value: "dark", label: "暗色", icon: Moon, color: "text-indigo-400" },
    { value: "system", label: "系统", icon: Monitor, color: "text-emerald-500" },
];

const ORBIT_A = 60;
const ORBIT_B = 24;

/**
 * OrbitingPlanets - 天体轨道主题切换器
 *
 * 中心是当前主题的主星，另外两颗小行星在椭圆轨道上运行。
 * 点击轨道上的小行星，它与中心主星交换位置。
 */
export function OrbitingPlanets() {
    const { theme, switchTheme } = useThemeSwitcher();
    const [hovered, setHovered] = useState<ThemeOption | null>(null);

    const currentIndex = choices.findIndex((c) => c.value === theme);
    const current = choices[currentIndex] ?? choices[0];

    return (
        <div className="relative flex h-40 w-40 items-center justify-center">
            <div className="pointer-events-none absolute inset-0 rounded-full border border-dashed border-border/60" />

            {choices.map((choice, index) => {
                if (index === currentIndex) return null;

                const offset =
                    index > currentIndex ? index - currentIndex : index + 3 - currentIndex;
                const angle = offset * 120 - 90;
                const radians = (angle * Math.PI) / 180;
                const x = Math.cos(radians) * ORBIT_A;
                const y = Math.sin(radians) * ORBIT_B;
                const Icon = choice.icon;

                return (
                    <motion.button
                        key={choice.value}
                        type="button"
                        layout
                        initial={false}
                        animate={{ x, y }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        onMouseEnter={() => setHovered(choice.value)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={(e) =>
                            switchTheme(choice.value, {
                                clientX: e.clientX,
                                clientY: e.clientY,
                            })
                        }
                        className="absolute flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background shadow-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={choice.label}
                    >
                        <Icon
                            className={`pointer-events-none size-4 transition-transform ${choice.color} ${hovered === choice.value ? "scale-110" : ""}`}
                        />
                    </motion.button>
                );
            })}

            <motion.button
                type="button"
                layout
                className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`当前主题：${current.label}`}
            >
                <motion.div
                    key={theme}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                    <current.icon className={`pointer-events-none size-5 ${current.color}`} />
                </motion.div>
            </motion.button>
        </div>
    );
}
