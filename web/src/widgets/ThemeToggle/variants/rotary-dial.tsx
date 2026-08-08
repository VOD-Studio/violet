import { Monitor, Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import type { ThemeOption, VariantProps } from "./types";
import { useThemeSwitcher } from "./use-theme-switcher";

const choices: { value: ThemeOption; label: string; icon: typeof Sun; angle: number }[] = [
	{ value: "light", label: "亮色", icon: Sun, angle: -90 },
	{ value: "dark", label: "暗色", icon: Moon, angle: 30 },
	{ value: "system", label: "系统", icon: Monitor, angle: 150 },
];

/**
 * RotaryDial - 旋钮式三态主题切换器
 *
 * 点击中心按钮后，三个选项沿 120° 间隔弹出。选择后圆盘收拢，
 * 中心图标更新。弹出的扇形按钮保证点击区域足够大。
 */
export function RotaryDial({ size = "default" }: VariantProps) {
	const RADIUS = size === "sm" ? 28 : 48;
	const containerCls = size === "sm" ? "h-20 w-20" : "h-36 w-36";
	const mainCls = size === "sm" ? "h-8 w-8" : "h-12 w-12";
	const mainIconCls = size === "sm" ? "size-4" : "size-5";
	const optionCls = size === "sm" ? "size-7" : "h-10 w-10";
	const optionIconCls = size === "sm" ? "size-3" : "size-4";
	const { theme, switchTheme } = useThemeSwitcher();
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const current = choices.find((c) => c.value === theme) ?? choices[0];
	const CurrentIcon = current.icon;

	const handleSelect = (value: ThemeOption, e: React.MouseEvent) => {
		switchTheme(value, { clientX: e.clientX, clientY: e.clientY });
		setOpen(false);
	};

	return (
		<div
			ref={containerRef}
			className={`relative flex ${containerCls} items-center justify-center`}
		>
			<AnimatePresence>
				{open && (
					<>
						{choices.map((choice) => {
							const Icon = choice.icon;
							const radians = (choice.angle * Math.PI) / 180;
							const x = Math.cos(radians) * RADIUS;
							const y = Math.sin(radians) * RADIUS;

							return (
								<motion.button
									key={choice.value}
									type="button"
									initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
									animate={{ scale: 1, x, y, opacity: 1 }}
									exit={{ scale: 0, x: 0, y: 0, opacity: 0 }}
									transition={{
										type: "spring",
										stiffness: 300,
										damping: 22,
										delay: choice.angle * 0.002,
									}}
									onClick={(e) => handleSelect(choice.value, e)}
									className={`absolute z-20 flex ${optionCls} items-center justify-center rounded-full border border-border bg-background shadow-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring`}
									aria-label={choice.label}
								>
									<Icon
										className={`pointer-events-none ${optionIconCls} text-foreground`}
									/>
								</motion.button>
							);
						})}
						<motion.div
							initial={{ scale: 0, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0, opacity: 0 }}
							className="absolute inset-0 rounded-full border border-dashed border-border"
						/>
					</>
				)}
			</AnimatePresence>

			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
				aria-expanded={open}
				aria-haspopup="true"
				className={`relative z-10 flex ${mainCls} items-center justify-center rounded-full border border-border bg-background shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring`}
			>
				<motion.div
					key={theme}
					initial={{ rotate: -90, opacity: 0 }}
					animate={{ rotate: 0, opacity: 1 }}
					transition={{ duration: 0.2 }}
				>
					<CurrentIcon className={`pointer-events-none ${mainIconCls} text-foreground`} />
				</motion.div>
				<span className="sr-only">切换主题</span>
			</button>
		</div>
	);
}
