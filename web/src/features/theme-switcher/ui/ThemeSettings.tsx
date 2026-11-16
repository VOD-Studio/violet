import { useThemeSwitcher } from "@features/theme-switcher/hooks/useThemeSwitcher";
import { themeChoiceTitle } from "@features/theme-switcher/model/choices";
import { DecorationPicker } from "@features/theme-switcher/ui/DecorationPicker";
import { CustomThemeSwatch, ThemeSwatch } from "@features/theme-switcher/ui/ThemeSwatch";
import { resolvePresetTheme, SEASONS } from "@shared/lib/theme-preference";
import { THEME_PRESETS } from "@shared/lib/theme-presets";
import { Button, iconProps } from "@violet/ui";
import { cn } from "cn";
import { CalendarDays, ChevronRight } from "lucide-react";
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
		<div className={cn("space-y-4", className)}>
			<section aria-label="主题配色">
				<h3 className="mb-2 text-xs font-medium text-muted-foreground">主题配色</h3>
				<RadioGroup.Root
					aria-label="主题"
					value={custom ? "custom" : preference}
					className="space-y-2"
				>
					<RadioGroup.Item
						value="follow"
						aria-label="跟随季节"
						onClick={() => void switchTheme("follow")}
						className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=checked]:border-muted-foreground data-[state=checked]:bg-muted data-[state=checked]:font-medium"
					>
						<CalendarDays aria-hidden {...iconProps(14)} />
						<span>跟随季节</span>
						<span className="ml-auto text-xs text-muted-foreground">
							此时 · {THEME_PRESETS[seasonNow].name}
						</span>
					</RadioGroup.Item>
					<div className="grid grid-cols-4 gap-2">
						{SEASONS.map((season) => (
							<RadioGroup.Item
								key={season}
								value={season}
								aria-label={themeChoiceTitle(season)}
								onClick={() => void switchTheme(season)}
								className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-1 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=checked]:border-muted-foreground data-[state=checked]:bg-muted data-[state=checked]:font-medium"
							>
								<ThemeSwatch theme={season} className="size-2.5" />
								{THEME_PRESETS[season].name}
							</RadioGroup.Item>
						))}
					</div>
				</RadioGroup.Root>
				<Button
					asChild
					variant="ghost"
					aria-label="自定义主题"
					aria-pressed={custom !== null}
					onClick={onCustomize}
					className="mt-2 min-h-9 w-full justify-start gap-2 rounded-lg px-3 text-sm"
				>
					<button type="button">
						<CustomThemeSwatch active={custom !== null} className="size-4" />
						<span>自定义</span>
						<span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
							{custom ? "已启用" : "调整配色"}
							<ChevronRight aria-hidden {...iconProps(14)} />
						</span>
					</button>
				</Button>
			</section>
			<DecorationPicker />
		</div>
	);
}
