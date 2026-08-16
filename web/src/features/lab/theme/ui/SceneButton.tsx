import { AnimatePresence, motion } from "motion/react";
import type { ThemeOption, VariantProps } from "./types";
import { useThemeSwitcher } from "./use-theme-switcher";

/**
 * SceneButton - 情景插画主题按钮
 *
 * 按钮内部是一个微缩场景：亮色时太阳高挂、暗色时月亮星星升起、
 * 系统状态时显示自动切换的提示。点击按钮循环切换三态。
 */
export function SceneButton({ size = "default" }: VariantProps) {
	const containerCls = size === "sm" ? "h-10 w-20" : size === "lg" ? "h-20 w-36" : "h-16 w-28";
	const { theme, switchTheme } = useThemeSwitcher();

	const cycleOrder: ThemeOption[] = ["light", "dark", "system"];
	const currentIndex = theme ? cycleOrder.indexOf(theme) : 0;
	const next = cycleOrder[(currentIndex + 1) % cycleOrder.length];

	const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		switchTheme(next, { clientX: e.clientX, clientY: e.clientY });
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			className={`group relative ${containerCls} overflow-hidden rounded-2xl border border-border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring`}
			aria-label="切换主题"
		>
			<AnimatePresence mode="wait">
				{theme === "light" && (
					<motion.div
						key="light"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.4 }}
						className="absolute inset-0 bg-linear-to-b from-sky-100 to-sky-50 dark:from-sky-950 dark:to-sky-900"
					>
						<motion.div
							initial={{ y: 40, opacity: 0 }}
							animate={{ y: 8, opacity: 1 }}
							exit={{ y: -40, opacity: 0 }}
							transition={{ type: "spring", stiffness: 120, damping: 14 }}
							className="absolute right-3 top-2 h-8 w-8 rounded-full bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.6)]"
						/>
						<motion.div
							initial={{ x: -20, opacity: 0 }}
							animate={{ x: 10, opacity: 0.8 }}
							exit={{ x: 40, opacity: 0 }}
							transition={{ delay: 0.1 }}
							className="absolute bottom-3 left-2 h-4 w-12 rounded-full bg-white/60"
						/>
					</motion.div>
				)}

				{theme === "dark" && (
					<motion.div
						key="dark"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.4 }}
						className="absolute inset-0 bg-linear-to-b from-slate-900 to-slate-800"
					>
						<motion.div
							initial={{ y: -40, opacity: 0 }}
							animate={{ y: 10, opacity: 1 }}
							exit={{ y: 40, opacity: 0 }}
							transition={{ type: "spring", stiffness: 120, damping: 14 }}
							className="absolute left-4 top-3 h-6 w-6 rounded-full bg-slate-100 shadow-[0_0_12px_rgba(255,255,255,0.4)]"
						/>
						{[...Array(3)].map((_, i) => (
							<motion.div
								key={i}
								initial={{ opacity: 0, scale: 0 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0 }}
								transition={{ delay: 0.1 + i * 0.08 }}
								className="absolute rounded-full bg-white"
								style={{
									width: 2 + i,
									height: 2 + i,
									right: 16 + i * 14,
									top: 14 + (i % 2) * 12,
								}}
							/>
						))}
					</motion.div>
				)}

				{theme === "system" && (
					<motion.div
						key="system"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.4 }}
						className="absolute inset-0 bg-linear-to-br from-muted to-accent/30"
					>
						<motion.div
							initial={{ scale: 0.8, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.8, opacity: 0 }}
							className="flex h-full w-full flex-col items-center justify-center"
						>
							<span className="text-xs font-medium text-foreground">Auto</span>
							<span className="text-[10px] text-muted-foreground">跟随系统</span>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</button>
	);
}
