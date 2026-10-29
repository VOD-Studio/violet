import { useDecorationSwitcher } from "@features/seasonal-decor/hooks/useDecorationSwitcher";
import { DECORATION_LAYERS, DECORATION_PREFERENCES } from "@shared/lib/decoration-preference";
import { seasonMonths } from "@shared/lib/theme-preference";
import { THEME_PRESETS } from "@shared/lib/theme-presets";
import { Check, ChevronRight } from "lucide-react";
import { DropdownMenu } from "radix-ui";

import { DECORATION_LAYER_LABELS, decorationChoiceTitle, themeChoiceTitle } from "../model/choices";

/** 选中后保留子菜单，便于连续配置装饰季节与图层。 */
export function DecorationSubmenu() {
	const { preference, season, layers, switchDecoration, setLayer } = useDecorationSwitcher();
	const label =
		preference === "theme"
			? `跟随主题，当前${season ? themeChoiceTitle(season) : "无"}`
			: decorationChoiceTitle(preference);

	return (
		<DropdownMenu.Sub>
			<DropdownMenu.SubTrigger className="v-dropdown__item cursor-default transition-colors motion-reduce:transition-none data-highlighted:bg-muted data-[state=open]:bg-muted">
				<span className="min-w-0 flex-1">
					<span className="block text-sm text-foreground">季节装饰</span>
					<span className="block text-xs text-muted-foreground">{label}</span>
				</span>
				<ChevronRight aria-hidden className="size-4 text-muted-foreground" />
			</DropdownMenu.SubTrigger>
			<DropdownMenu.Portal>
				<DropdownMenu.SubContent
					aria-label="季节装饰"
					sideOffset={4}
					collisionPadding={8}
					className="dialect-public v-dropdown__content w-56 motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
				>
					<DropdownMenu.RadioGroup value={preference} aria-label="装饰">
						{DECORATION_PREFERENCES.map((choice) => (
							<DropdownMenu.RadioItem
								key={choice}
								value={choice}
								onSelect={(event) => {
									event.preventDefault();
									void switchDecoration(choice);
								}}
								className="v-dropdown__item cursor-default transition-colors motion-reduce:transition-none data-highlighted:bg-muted"
							>
								<span className="min-w-0 flex-1">
									<span className="block text-sm text-foreground">
										{choice === "theme" || choice === "none"
											? decorationChoiceTitle(choice)
											: THEME_PRESETS[choice].label}
									</span>
									<span className="block text-xs text-muted-foreground">
										{choice === "theme"
											? "主题换季时装饰同换"
											: choice === "none"
												? "不显示装饰"
												: seasonMonths(choice)}
									</span>
								</span>
								<DropdownMenu.ItemIndicator>
									<Check aria-hidden className="size-4 text-primary" />
								</DropdownMenu.ItemIndicator>
							</DropdownMenu.RadioItem>
						))}
					</DropdownMenu.RadioGroup>
					<DropdownMenu.Separator className="mx-3 my-1 h-px bg-border/60" />
					<DropdownMenu.Label className="px-3 pt-1.5 pb-1 text-xs text-muted-foreground">
						显示图层
					</DropdownMenu.Label>
					{DECORATION_LAYERS.map((layer) => (
						<DropdownMenu.CheckboxItem
							key={layer}
							checked={layers[layer]}
							onSelect={(event) => event.preventDefault()}
							onCheckedChange={(enabled) => void setLayer(layer, enabled === true)}
							className="v-dropdown__item cursor-default transition-colors motion-reduce:transition-none data-highlighted:bg-muted"
						>
							<span className="flex-1 text-sm text-foreground">
								{DECORATION_LAYER_LABELS[layer]}
							</span>
							<DropdownMenu.ItemIndicator>
								<Check aria-hidden className="size-4 text-primary" />
							</DropdownMenu.ItemIndicator>
						</DropdownMenu.CheckboxItem>
					))}
				</DropdownMenu.SubContent>
			</DropdownMenu.Portal>
		</DropdownMenu.Sub>
	);
}
