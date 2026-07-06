import { Monitor, Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { ThemeOption } from "./types";
import { useThemeSwitcher } from "./use-theme-switcher";

const choices: { value: ThemeOption; label: string; icon: typeof Sun; color: string }[] = [
    { value: "light", label: "亮色", icon: Sun, color: "text-amber-500" },
    { value: "dark", label: "暗色", icon: Moon, color: "text-indigo-400" },
    { value: "system", label: "系统", icon: Monitor, color: "text-emerald-500" },
];

/**
 * PieMenuToggle - 三分圆盘主题切换器
 *
 * 中心显示当前主题图标，点击后 SVG 三等分圆盘展开。每个 120° 扇区
 * 对应一个选项，选中后圆盘收拢，中心图标更新。
 */
export function PieMenuToggle() {
    const { theme, switchTheme } = useThemeSwitcher();
    const [open, setOpen] = useState(false);

    const current = choices.find((c) => c.value === theme) ?? choices[0];
    const CurrentIcon = current.icon;

    const handleSelect = (value: ThemeOption, e: React.MouseEvent) => {
        switchTheme(value, { clientX: e.clientX, clientY: e.clientY });
        setOpen(false);
    };

    const radius = 72;
    const innerRadius = 28;

    const sectorPath = (startAngle: number, endAngle: number): string => {
        const start = (startAngle * Math.PI) / 180;
        const end = (endAngle * Math.PI) / 180;
        const x1 = Math.cos(start) * innerRadius;
        const y1 = Math.sin(start) * innerRadius;
        const x2 = Math.cos(start) * radius;
        const y2 = Math.sin(start) * radius;
        const x3 = Math.cos(end) * radius;
        const y3 = Math.sin(end) * radius;
        const x4 = Math.cos(end) * innerRadius;
        const y4 = Math.sin(end) * innerRadius;

        return `M ${x1} ${y1} L ${x2} ${y2} A ${radius} ${radius} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 0 0 ${x1} ${y1} Z`;
    };

    return (
        <div className="relative flex h-48 w-48 items-center justify-center">
            <AnimatePresence>
                {open && (
                    <motion.svg
                        initial={{ scale: 0, opacity: 0, rotate: -30 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0, opacity: 0, rotate: 30 }}
                        transition={{ type: "spring", stiffness: 260, damping: 22 }}
                        width="192"
                        height="192"
                        viewBox="-96 -96 192 192"
                        className="absolute inset-0"
                    >
                        {choices.map((choice, index) => {
                            const startAngle = index * 120 - 90;
                            const endAngle = startAngle + 120;
                            const midAngle = (startAngle + endAngle) / 2;
                            const labelRadius = (radius + innerRadius) / 2;
                            const lx = Math.cos((midAngle * Math.PI) / 180) * labelRadius;
                            const ly = Math.sin((midAngle * Math.PI) / 180) * labelRadius;
                            const Icon = choice.icon;

                            return (
                                <g
                                    key={choice.value}
                                    className="cursor-pointer"
                                    onClick={(e) => handleSelect(choice.value, e)}
                                >
                                    <motion.path
                                        d={sectorPath(startAngle, endAngle)}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: index * 0.04 }}
                                        className="fill-muted stroke-border transition-colors hover:fill-accent"
                                    />
                                    <foreignObject
                                        x={lx - 10}
                                        y={ly - 10}
                                        width="20"
                                        height="20"
                                        className="pointer-events-none"
                                    >
                                        <div className="flex h-full w-full items-center justify-center">
                                            <Icon className={`size-4 ${choice.color}`} />
                                        </div>
                                    </foreignObject>
                                </g>
                            );
                        })}
                    </motion.svg>
                )}
            </AnimatePresence>

            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
                aria-haspopup="true"
                className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background shadow-sm outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
            >
                <motion.div
                    key={theme}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                    <CurrentIcon className={`size-5 ${current.color}`} />
                </motion.div>
                <span className="sr-only">切换主题</span>
            </button>
        </div>
    );
}
