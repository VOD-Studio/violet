import {
	resolvePresetTheme,
	SEASONS,
	seasonMonths,
	type ThemePreference,
} from "@shared/lib/theme-preference";
import { Check } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { type ReactNode, useState } from "react";

import { originOf, useThemeSwitcher } from "../hooks/useThemeSwitcher";
import { themeChoiceTitle } from "../model/choices";
import { CustomThemeDialog } from "./CustomThemeDialog";
import { DecorationSubmenu } from "./DecorationMenu";
import { CustomThemeSwatch, ThemeSwatch } from "./ThemeSwatch";

/** 顶栏主题菜单的属性。 */
export interface ThemeMenuProps {
	/** 菜单开合变化，供顶栏在菜单打开时保持工具区展开 */
	onOpenChange?: (open: boolean) => void;
}

interface ThemeOptionProps {
	value: ThemePreference | "custom";
	swatch: ReactNode;
	title: string;
	detail: string;
	/** 选中时回传选项元素，用于从该位置开始扩散 */
	onSelect: (item: HTMLElement) => void;
}

function ThemeOption({ value, swatch, title, detail, onSelect }: ThemeOptionProps) {
	return (
		<DropdownMenu.RadioItem
			value={value}
			onSelect={(event) => onSelect(event.currentTarget as HTMLElement)}
			className="v-dropdown__item cursor-default transition-colors data-highlighted:bg-muted"
		>
			{swatch}
			<span className="min-w-0 flex-1">
				<span className="block text-sm text-foreground">{title}</span>
				<span className="block text-xs text-muted-foreground">{detail}</span>
			</span>
			<DropdownMenu.ItemIndicator>
				<Check aria-hidden className="size-4 text-primary" />
			</DropdownMenu.ItemIndicator>
		</DropdownMenu.RadioItem>
	);
}

const Separator = () => <DropdownMenu.Separator className="mx-3 my-1 h-px bg-border/60" />;

/**
 * 顶栏的主题菜单：跟随季节、指定四季之一或自定义主题，选中后即时生效并写入偏好；
 * 子菜单切换季节装饰偏好。
 *
 * @remarks 内容经 Portal 渲染，避开顶栏工具区的溢出裁剪；面板沿用 Dropdown 的公开样式，只淡入淡出。
 */
export function ThemeMenu({ onOpenChange }: ThemeMenuProps) {
	const { preference, preset, custom, switchTheme } = useThemeSwitcher();
	const [customOpen, setCustomOpen] = useState(false);
	const current = themeChoiceTitle(preset);
	const triggerLabel = custom
		? `主题：自定义 ${custom.seed}`
		: preference === "follow"
			? `主题：跟随季节，当前${current}`
			: `主题：${current}`;
	const seasonNow = resolvePresetTheme("follow", new Date());

	return (
		<>
			<DropdownMenu.Root modal={false} onOpenChange={onOpenChange}>
				<DropdownMenu.Trigger
					type="button"
					aria-label={triggerLabel}
					className="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:bg-muted/70"
				>
					<ThemeSwatch theme={custom ? "custom" : preset} className="size-3.5" />
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
						<DropdownMenu.RadioGroup value={custom ? "custom" : preference}>
							<ThemeOption
								value="follow"
								swatch={<ThemeSwatch theme={seasonNow} className="size-4" />}
								title={themeChoiceTitle("follow")}
								detail={`现在是${themeChoiceTitle(seasonNow)}`}
								onSelect={(item) => void switchTheme("follow", originOf(item))}
							/>
							<Separator />
							{SEASONS.map((season) => (
								<ThemeOption
									key={season}
									value={season}
									swatch={<ThemeSwatch theme={season} className="size-4" />}
									title={themeChoiceTitle(season)}
									detail={seasonMonths(season)}
									onSelect={(item) => void switchTheme(season, originOf(item))}
								/>
							))}
							<Separator />
							<ThemeOption
								value="custom"
								swatch={
									<CustomThemeSwatch
										active={custom !== null}
										className="size-4"
									/>
								}
								title="自定义"
								detail={custom ? custom.seed.toUpperCase() : "选一个种子色"}
								onSelect={() => setCustomOpen(true)}
							/>
						</DropdownMenu.RadioGroup>
						<Separator />
						<DecorationSubmenu />
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
			<CustomThemeDialog open={customOpen} onOpenChange={setCustomOpen} />
		</>
	);
}
