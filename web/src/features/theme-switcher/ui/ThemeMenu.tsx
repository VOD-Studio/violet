import {
	resolvePresetTheme,
	type Season,
	seasonMonths,
	type ThemePreference,
} from "@shared/lib/theme-preference";
import { Check } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Fragment } from "react";

import { useThemeSwitcher } from "../hooks/useThemeSwitcher";
import { THEME_CHOICES, themeChoiceTitle } from "../model/choices";
import { PresetSwatch } from "./PresetSwatch";

/** 顶栏主题菜单的属性。 */
export interface ThemeMenuProps {
	/** 菜单开合变化，供顶栏在菜单打开时保持工具区展开 */
	onOpenChange?: (open: boolean) => void;
}

interface ThemeOptionProps {
	value: ThemePreference;
	/** 圆点展示的预设；跟随季节时为当前季节 */
	swatch: Season;
	detail: string;
	/** 选中时回传选项元素，用于从该位置开始扩散 */
	onSelect: (value: ThemePreference, item: HTMLElement) => void;
}

function ThemeOption({ value, swatch, detail, onSelect }: ThemeOptionProps) {
	return (
		<DropdownMenu.RadioItem
			value={value}
			onSelect={(event) => onSelect(value, event.currentTarget as HTMLElement)}
			className="v-dropdown__item cursor-default transition-colors data-highlighted:bg-muted"
		>
			<PresetSwatch season={swatch} className="size-4" />
			<span className="min-w-0 flex-1">
				<span className="block text-sm text-foreground">{themeChoiceTitle(value)}</span>
				<span className="block text-xs text-muted-foreground">{detail}</span>
			</span>
			<DropdownMenu.ItemIndicator>
				<Check aria-hidden className="size-4 text-primary" />
			</DropdownMenu.ItemIndicator>
		</DropdownMenu.RadioItem>
	);
}

/**
 * 顶栏的主题菜单：跟随季节或指定四季之一，选中后即时生效并写入偏好。
 *
 * @remarks 内容经 Portal 渲染，避开顶栏工具区的溢出裁剪；面板沿用 Dropdown 的公开样式，只淡入淡出。
 */
export function ThemeMenu({ onOpenChange }: ThemeMenuProps) {
	const { preference, preset, switchTheme } = useThemeSwitcher();
	const current = themeChoiceTitle(preset);
	const triggerLabel =
		preference === "follow" ? `主题：跟随季节，当前${current}` : `主题：${current}`;
	const seasonNow = resolvePresetTheme("follow", new Date());

	const select = (value: ThemePreference, item: HTMLElement) => {
		const rect = item.getBoundingClientRect();
		void switchTheme(value, {
			px: rect.left + rect.width / 2,
			py: rect.top + rect.height / 2,
		});
	};

	return (
		<DropdownMenu.Root modal={false} onOpenChange={onOpenChange}>
			<DropdownMenu.Trigger
				aria-label={triggerLabel}
				className="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:bg-muted/70"
			>
				<PresetSwatch season={preset} className="size-3.5" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align="end"
					sideOffset={14}
					collisionPadding={8}
					className="dialect-public v-dropdown__content w-64 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
				>
					<DropdownMenu.Label className="px-3 pt-1.5 pb-1 text-xs text-muted-foreground">
						主题
					</DropdownMenu.Label>
					<DropdownMenu.RadioGroup value={preference}>
						{THEME_CHOICES.map((choice) =>
							choice === "follow" ? (
								<Fragment key={choice}>
									<ThemeOption
										value={choice}
										swatch={seasonNow}
										detail={`现在是${themeChoiceTitle(seasonNow)}`}
										onSelect={select}
									/>
									<DropdownMenu.Separator className="mx-3 my-1 h-px bg-border/60" />
								</Fragment>
							) : (
								<ThemeOption
									key={choice}
									value={choice}
									swatch={choice}
									detail={seasonMonths(choice)}
									onSelect={select}
								/>
							),
						)}
					</DropdownMenu.RadioGroup>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}
