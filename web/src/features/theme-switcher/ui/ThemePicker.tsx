import { resolvePresetTheme } from "@shared/lib/theme-preference";
import { THEME_PRESETS } from "@shared/lib/theme-presets";
import { cn } from "cn";

import { useThemeSwitcher } from "../hooks/useThemeSwitcher";
import { THEME_CHOICES, themeChoiceTitle } from "../model/choices";
import { PresetSwatch } from "./PresetSwatch";

/**
 * 内联的主题单选，用于移动端导航面板等不能悬停展开菜单的位置。
 *
 * @remarks 只在客户端展开的面板里渲染，「跟随季节」的圆点按客户端时钟取当前季节。
 */
export function ThemePicker({ className }: { className?: string }) {
	const { preference, switchTheme } = useThemeSwitcher();
	const seasonNow = resolvePresetTheme("follow", new Date());

	return (
		<div
			role="radiogroup"
			aria-label="主题"
			className={cn("grid grid-cols-5 gap-1", className)}
		>
			{THEME_CHOICES.map((choice) => (
				<button
					key={choice}
					type="button"
					role="radio"
					aria-checked={preference === choice}
					aria-label={themeChoiceTitle(choice)}
					onClick={(event) => {
						const rect = event.currentTarget.getBoundingClientRect();
						void switchTheme(choice, {
							px: rect.left + rect.width / 2,
							py: rect.top + rect.height / 2,
						});
					}}
					className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-checked:bg-selected aria-checked:text-selected-foreground"
				>
					<PresetSwatch
						season={choice === "follow" ? seasonNow : choice}
						className="size-5"
					/>
					{choice === "follow" ? "跟随" : THEME_PRESETS[choice].label}
				</button>
			))}
		</div>
	);
}
