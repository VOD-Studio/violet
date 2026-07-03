import { motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import type { ThemeOption } from "./types";
import { useThemeSwitcher } from "./use-theme-switcher";

const choices: { value: ThemeOption; label: string; icon: typeof Sun; rotation: number }[] = [
    { value: "light", label: "亮色", icon: Sun, rotation: 0 },
    { value: "dark", label: "暗色", icon: Moon, rotation: 120 },
    { value: "system", label: "系统", icon: Monitor, rotation: 240 },
];

/**
 * CubeToggle - 3D 立方体主题切换器
 *
 * 立方体三个面分别对应三态，点击后沿 Y 轴旋转到对应面。
 * 每个面的背景色略有区分，增强 3D 可读性。
 */
export function CubeToggle() {
    const { theme, switchTheme } = useThemeSwitcher();
    const [rotation, setRotation] = useState(0);

    const current = choices.find((c) => c.value === theme) ?? choices[0];

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        const nextIndex = (choices.findIndex((c) => c.value === theme) + 1) % choices.length;
        const next = choices[nextIndex];
        if (!next) return;

        const newRotation = rotation + ((next.rotation - current.rotation + 360) % 360);
        if (newRotation === rotation) {
            const fallbackRotation = rotation + 120;
            setRotation(fallbackRotation);
            switchTheme(next.value, { clientX: e.clientX, clientY: e.clientY });
            return;
        }

        setRotation(newRotation);
        switchTheme(next.value, { clientX: e.clientX, clientY: e.clientY });
    };

    return (
        <div
            className="group relative flex h-16 w-16 items-center justify-center"
            style={{ perspective: "600px" }}
        >
            <motion.div
                className="relative h-12 w-12"
                style={{ transformStyle: "preserve-3d" }}
                animate={{ rotateY: rotation }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            >
                {choices.map((choice) => {
                    const Icon = choice.icon;
                    return (
                        <div
                            key={choice.value}
                            className="absolute inset-0 flex items-center justify-center rounded-lg border border-border shadow-sm backface-hidden"
                            style={{
                                transform: `rotateY(${choice.rotation}deg) translateZ(24px)`,
                                backgroundColor:
                                    choice.value === "light"
                                        ? "hsl(var(--background))"
                                        : choice.value === "dark"
                                          ? "hsl(var(--muted))"
                                          : "hsl(var(--accent))",
                            }}
                        >
                            <Icon className="size-5 text-foreground" />
                        </div>
                    );
                })}
            </motion.div>

            <button
                type="button"
                onClick={handleClick}
                className="absolute inset-0 z-20 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`切换主题，当前：${current.label}`}
            />
        </div>
    );
}
