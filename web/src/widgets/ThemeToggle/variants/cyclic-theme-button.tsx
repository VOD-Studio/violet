import { Monitor, Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { VariantProps } from "./types";
import { useThemeSwitcher } from "./use-theme-switcher";

const cycle = ["light", "dark", "system"] as const;

/**
 * CyclicThemeButton - 单键循环主题切换器
 *
 * 一个按钮循环切换 light → dark → system → light。当前图标做缩放/旋转形变，
 * 点击位置作为圆形扩散动画起点。
 */
export function CyclicThemeButton({ size = "default" }: VariantProps) {
	const { theme, switchTheme } = useThemeSwitcher();

	const currentIndex = theme ? cycle.indexOf(theme as (typeof cycle)[number]) : 0;
	const next = cycle[(currentIndex + 1) % cycle.length];

	const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		switchTheme(next, { clientX: e.clientX, clientY: e.clientY });
	};

	const sizeCls = size === "sm" ? "size-9" : "size-12";
	const iconCls = size === "sm" ? "size-4" : "size-5";

	return (
		<button
			type="button"
			onClick={handleClick}
			className={`relative flex items-center justify-center rounded-full border border-border bg-background shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${sizeCls}`}
			aria-label="切换主题"
		>
			<AnimatePresence mode="wait" initial={false}>
				{theme === "light" && (
					<motion.div
						key="light"
						initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
						animate={{ rotate: 0, scale: 1, opacity: 1 }}
						exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
						transition={{ duration: 0.2 }}
					>
						<Sun className={`${iconCls} text-amber-500`} />
					</motion.div>
				)}
				{theme === "dark" && (
					<motion.div
						key="dark"
						initial={{ rotate: 90, scale: 0.5, opacity: 0 }}
						animate={{ rotate: 0, scale: 1, opacity: 1 }}
						exit={{ rotate: -90, scale: 0.5, opacity: 0 }}
						transition={{ duration: 0.2 }}
					>
						<Moon className={`${iconCls} text-indigo-400`} />
					</motion.div>
				)}
				{theme === "system" && (
					<motion.div
						key="system"
						initial={{ scale: 0.5, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 0.5, opacity: 0 }}
						transition={{ duration: 0.2 }}
					>
						<Monitor className={`${iconCls} text-emerald-500`} />
					</motion.div>
				)}
			</AnimatePresence>
		</button>
	);
}
