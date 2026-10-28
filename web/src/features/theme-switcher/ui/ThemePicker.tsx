import { resolvePresetTheme } from "@shared/lib/theme-preference";
import { THEME_PRESETS } from "@shared/lib/theme-presets";
import { cn } from "cn";
import { useState } from "react";

import { originOf, useThemeSwitcher } from "../hooks/useThemeSwitcher";
import { THEME_CHOICES, themeChoiceTitle } from "../model/choices";
import { CustomThemeDialog } from "./CustomThemeDialog";
import { DecorationPicker } from "./DecorationPicker";
import { CustomThemeSwatch, ThemeSwatch } from "./ThemeSwatch";

const OPTION_CLASS =
	"flex flex-col items-center gap-1.5 rounded-xl py-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-checked:bg-selected aria-checked:text-selected-foreground";

/**
 * 内联的主题单选，用于移动端导航面板等不能悬停展开菜单的位置。
 *
 * @remarks 只在客户端展开的面板里渲染，「跟随季节」的圆点按客户端时钟取当前季节。
 */
export function ThemePicker({ className }: { className?: string }) {
	const { preference, custom, switchTheme } = useThemeSwitcher();
	const [customOpen, setCustomOpen] = useState(false);
	const seasonNow = resolvePresetTheme("follow", new Date());

	return (
		<>
			<div
				role="radiogroup"
				aria-label="主题"
				className={cn("grid grid-cols-6 gap-1", className)}
			>
				{THEME_CHOICES.map((choice) => (
					<button
						key={choice}
						type="button"
						role="radio"
						aria-checked={!custom && preference === choice}
						aria-label={themeChoiceTitle(choice)}
						onClick={(event) => void switchTheme(choice, originOf(event.currentTarget))}
						className={OPTION_CLASS}
					>
						<ThemeSwatch
							theme={choice === "follow" ? seasonNow : choice}
							className="size-5"
						/>
						{choice === "follow" ? "跟随" : THEME_PRESETS[choice].label}
					</button>
				))}
				<button
					type="button"
					role="radio"
					aria-checked={custom !== null}
					aria-label="自定义主题"
					onClick={() => setCustomOpen(true)}
					className={OPTION_CLASS}
				>
					<CustomThemeSwatch active={custom !== null} className="size-5" />
					自定义
				</button>
			</div>
			<DecorationPicker className={cn("mt-3", className)} />
			<CustomThemeDialog open={customOpen} onOpenChange={setCustomOpen} />
		</>
	);
}
