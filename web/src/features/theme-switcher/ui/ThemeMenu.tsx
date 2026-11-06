import { useThemeSwitcher } from "@features/theme-switcher/hooks/useThemeSwitcher";
import { CustomThemeDialog } from "@features/theme-switcher/ui/CustomThemeDialog";
import { ThemeSettings } from "@features/theme-switcher/ui/ThemeSettings";
import { THEME_PRESETS } from "@shared/lib/theme-presets";
import { SeasonGlyph } from "@shared/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@violet/ui";
import { type ReactNode, useState } from "react";

/** 顶栏「季节与外观」入口的属性。 */
export interface ThemeMenuProps {
	/**
	 * 面板顶部「外观」一节的内容（明、暗、跟随系统的切换器）。
	 *
	 * 外观切换在 appearance feature，feature 之间不互相引用，由宿主传入；省略时面板不含该节。
	 */
	appearance?: ReactNode;
}

/**
 * 顶栏「季节与外观」入口：当季花形按钮，点开是单层设置浮层，
 * 顶部是外观，其后是主题配色与装饰；连续切换时保持打开。
 */
export function ThemeMenu({ appearance }: ThemeMenuProps) {
	const { preset, custom } = useThemeSwitcher();
	const [customOpen, setCustomOpen] = useState(false);
	const triggerLabel = `季节与外观：${custom ? "自定义" : THEME_PRESETS[preset].name}`;

	return (
		<>
			<Popover>
				<PopoverTrigger
					type="button"
					aria-label={triggerLabel}
					className="flex size-8 shrink-0 items-center justify-center rounded-full text-decoration transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:bg-muted/70"
				>
					<SeasonGlyph season={preset} size={18} />
				</PopoverTrigger>
				<PopoverContent
					aria-label="季节与外观"
					align="end"
					onInteractOutside={(event) => {
						if (customOpen) event.preventDefault();
					}}
					className="max-h-(--radix-popover-content-available-height) w-80 max-w-[calc(100vw-1rem)] overflow-y-auto"
				>
					<div className="space-y-5">
						{appearance != null && (
							<section aria-label="外观">
								<h3 className="mb-2 text-xs font-medium text-muted-foreground">
									外观
								</h3>
								{appearance}
							</section>
						)}
						<ThemeSettings
							onCustomize={() => setCustomOpen(true)}
							className={
								appearance != null ? "border-t border-border/60 pt-4" : undefined
							}
						/>
					</div>
				</PopoverContent>
			</Popover>
			<CustomThemeDialog open={customOpen} onOpenChange={setCustomOpen} />
		</>
	);
}
