import { useThemeSwitcher } from "@features/theme-switcher/hooks/useThemeSwitcher";
import { themeChoiceTitle } from "@features/theme-switcher/model/choices";
import { DecorationPicker } from "@features/theme-switcher/ui/DecorationPicker";
import { CustomThemeSwatch, ThemeSwatch } from "@features/theme-switcher/ui/ThemeSwatch";
import { resolvePresetTheme, SEASONS } from "@shared/lib/theme-preference";
import { THEME_PRESETS } from "@shared/lib/theme-presets";
import { Button } from "@violet/ui";
import { cn } from "cn";
import { CalendarDays } from "lucide-react";
import { RadioGroup } from "radix-ui";

/** 桌面浮层与移动导航共用的主题及装饰设置。 */
export interface ThemeSettingsProps {
	/** 自定义对话框由宿主挂载，不随设置浮层关闭而卸载。 */
	onCustomize: () => void;
	className?: string;
}

export function ThemeSettings({ onCustomize, className }: ThemeSettingsProps) {
	const { preference, custom, switchTheme } = useThemeSwitcher("instant");
	const seasonNow = resolvePresetTheme("follow", new Date());

	return (
		<div className={cn("space-y-5", className)}>
			<section aria-label="主题配色">
				<div className="mb-2 flex items-center justify-between gap-3">
					<h3 className="text-xs font-medium text-muted-foreground">主题配色</h3>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						aria-label="自定义主题"
						aria-pressed={custom !== null}
						onClick={onCustomize}
						className={cn(
							"h-7 gap-1.5 px-2 text-xs",
							custom && "bg-selected text-selected-foreground",
						)}
					>
						<CustomThemeSwatch active={custom !== null} className="size-3.5" />
						自定义
					</Button>
				</div>
				<RadioGroup.Root
					aria-label="主题"
					value={custom ? "custom" : preference}
					className="space-y-2"
				>
					<RadioGroup.Item
						value="follow"
						aria-label="跟随季节"
						onClick={() => void switchTheme("follow")}
						className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-xs transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=checked]:bg-selected data-[state=checked]:text-selected-foreground"
					>
						<CalendarDays aria-hidden className="size-3.5 text-muted-foreground" />
						<span>跟随季节</span>
						<span className="ml-auto text-[11px] text-muted-foreground">
							当前{themeChoiceTitle(seasonNow)}
						</span>
					</RadioGroup.Item>
					<div className="grid grid-cols-4 gap-2">
						{SEASONS.map((season) => (
							<RadioGroup.Item
								key={season}
								value={season}
								aria-label={themeChoiceTitle(season)}
								onClick={() => void switchTheme(season)}
								className="flex min-h-18 flex-col items-center justify-center gap-1 rounded-xl border border-transparent bg-muted/40 px-1 py-2 text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=checked]:border-primary/50 data-[state=checked]:bg-selected data-[state=checked]:text-selected-foreground"
							>
								<div className="flex items-center gap-1.5 text-sm font-medium">
									<ThemeSwatch theme={season} className="size-3" />
									{THEME_PRESETS[season].label}
								</div>
								<span className="text-[11px] text-muted-foreground">
									{THEME_PRESETS[season].name}
								</span>
							</RadioGroup.Item>
						))}
					</div>
				</RadioGroup.Root>
			</section>
			<DecorationPicker className="border-t border-border/60 pt-4" />
		</div>
	);
}
