import { useThemeSwitcher } from "@features/theme-switcher/hooks/useThemeSwitcher";
import { themeChoiceTitle } from "@features/theme-switcher/model/choices";
import { CustomThemeDialog } from "@features/theme-switcher/ui/CustomThemeDialog";
import { ThemeSettings } from "@features/theme-switcher/ui/ThemeSettings";
import { ThemeSwatch } from "@features/theme-switcher/ui/ThemeSwatch";
import { Popover, PopoverContent, PopoverTrigger } from "@violet/ui";
import { useState } from "react";

/** 顶栏主题设置面板的属性。 */
export interface ThemeMenuProps {
	/** 面板开合变化，供顶栏在配置期间保持工具区展开。 */
	onOpenChange?: (open: boolean) => void;
}

/** 单层设置浮层；连续切换主题和装饰时保持打开。 */
export function ThemeMenu({ onOpenChange }: ThemeMenuProps) {
	const { preference, preset, custom } = useThemeSwitcher();
	const [customOpen, setCustomOpen] = useState(false);
	const current = themeChoiceTitle(preset);
	const triggerLabel = custom
		? `主题：自定义 ${custom.seed}`
		: preference === "follow"
			? `主题：跟随季节，当前${current}`
			: `主题：${current}`;

	return (
		<>
			<Popover onOpenChange={onOpenChange}>
				<PopoverTrigger
					type="button"
					aria-label={triggerLabel}
					className="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:bg-muted/70"
				>
					<ThemeSwatch theme={custom ? "custom" : preset} className="size-3.5" />
				</PopoverTrigger>
				<PopoverContent
					aria-label="主题与装饰"
					align="end"
					sideOffset={14}
					collisionPadding={8}
					onInteractOutside={(event) => {
						if (customOpen) event.preventDefault();
					}}
					className="dialect-public max-h-(--radix-popover-content-available-height) w-80 max-w-[calc(100vw-1rem)] animate-none! overflow-y-auto rounded-2xl border-edge-hairline p-4 shadow-none"
				>
					<ThemeSettings onCustomize={() => setCustomOpen(true)} />
				</PopoverContent>
			</Popover>
			<CustomThemeDialog open={customOpen} onOpenChange={setCustomOpen} />
		</>
	);
}
