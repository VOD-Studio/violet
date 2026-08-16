import { Monitor, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useId } from "react";
import type { ThemeOption, ThemeSize } from "./types";
import { useThemeSwitcher } from "./use-theme-switcher";

const choices: { value: ThemeOption; label: string; icon: typeof Sun }[] = [
	{ value: "light", label: "亮色", icon: Sun },
	{ value: "dark", label: "暗黑", icon: Moon },
	{ value: "system", label: "跟随系统", icon: Monitor },
];

const dims: Record<ThemeSize, { pad: string; cell: string; icon: string }> = {
	lg: { pad: "p-1.5", cell: "h-12 w-20", icon: "size-5" },
	default: { pad: "p-1", cell: "h-9 w-16", icon: "size-4" },
	sm: { pad: "p-0.5", cell: "size-7", icon: "size-3.5" },
};

interface SegmentedToggleProps {
	/** 紧凑尺寸适配 Header 操作区，lg/default 用于 theme-lab 陈列 */
	size?: ThemeSize;
}

/**
 * SegmentedToggle - 三段胶囊拨动开关
 *
 * 三个等分格排成一行，滑块用 layoutId 平滑跟随当前主题。
 * 点击任一格子切换到对应主题，配合 useThemeSwitcher 的圆形扩散动画。
 */
export function SegmentedToggle({ size = "default" }: SegmentedToggleProps) {
	const { theme, switchTheme } = useThemeSwitcher();
	const layoutId = useId();

	const { pad, cell, icon } = dims[size];

	return (
		<div
			className={`relative inline-flex items-center rounded-full border border-border bg-muted ${pad}`}
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
						className={`group relative z-10 flex items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${cell}`}
					>
						{isActive && (
							<motion.div
								layoutId={layoutId}
								className="absolute inset-0 rounded-full bg-background shadow-sm"
								transition={{ type: "spring", stiffness: 380, damping: 30 }}
								initial={false}
							/>
						)}
						<Icon
							className={`relative z-10 transition-colors ${icon} ${
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
