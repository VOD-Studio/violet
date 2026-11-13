import { type IconSize, iconProps, Segmented } from "@violet/ui";
import { Monitor, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useId } from "react";
import { useAppearanceSwitcher } from "../hooks/useAppearanceSwitcher";
import type { AppearanceOption, AppearanceSize } from "./types";

const choices: { value: AppearanceOption; label: string; icon: typeof Sun }[] = [
	{ value: "light", label: "亮色", icon: Sun },
	{ value: "dark", label: "暗黑", icon: Moon },
	{ value: "system", label: "跟随系统", icon: Monitor },
];

const dims: Record<AppearanceSize, { pad: string; cell: string; icon: IconSize }> = {
	lg: { pad: "p-1.5", cell: "h-12 w-20", icon: 20 },
	default: { pad: "p-1", cell: "h-9 w-16", icon: 16 },
	sm: { pad: "p-0.5", cell: "size-7", icon: 14 },
};

interface SegmentedToggleProps {
	/** 控制每项高度与图标尺寸。 */
	size?: AppearanceSize;
	/** 显示文字并沿容器宽度等分；省略时保留紧凑图标形态。 */
	showLabels?: boolean;
}

/**
 * 三态外观切换，文字形态复用分段器的单一 Tab 停靠与方向键操作。
 */
export function SegmentedToggle({ size = "default", showLabels = false }: SegmentedToggleProps) {
	const { appearance, switchAppearance } = useAppearanceSwitcher();
	const layoutId = useId();

	const { pad, cell, icon } = dims[size];

	if (showLabels) {
		return (
			<Segmented
				aria-label="外观切换"
				value={appearance ?? ""}
				onValueChange={(value) => {
					const choice = choices.find((item) => item.value === value);
					if (choice) switchAppearance(choice.value);
				}}
				segments={choices.map(({ value, label, icon: Icon }) => ({
					value,
					label,
					icon: <Icon aria-hidden {...iconProps(icon)} />,
				}))}
				size={size}
				variant="soft"
				block
				itemClassName="gap-1.5 px-1 text-xs"
			/>
		);
	}

	return (
		<div
			className={`relative inline-flex items-center rounded-full border border-border bg-muted ${pad}`}
			role="radiogroup"
			aria-label="外观切换"
		>
			{choices.map((choice) => {
				const isActive = appearance === choice.value;
				const Icon = choice.icon;

				return (
					<button
						key={choice.value}
						type="button"
						role="radio"
						aria-checked={isActive}
						onClick={(e) =>
							switchAppearance(choice.value, {
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
							{...iconProps(
								icon,
								`relative z-10 transition-colors ${
									isActive
										? "text-foreground"
										: "text-muted-foreground group-hover:text-foreground/80"
								}`,
							)}
						/>
						<span className="sr-only">{choice.label}</span>
					</button>
				);
			})}
		</div>
	);
}
