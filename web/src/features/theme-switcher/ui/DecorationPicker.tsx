import { useDecorationSwitcher } from "@features/seasonal-decor/hooks/useDecorationSwitcher";
import {
	DECORATION_LAYER_LABELS,
	decorationChoiceTitle,
	themeChoiceTitle,
} from "@features/theme-switcher/model/choices";
import { DECORATION_LAYERS, DECORATION_PREFERENCES } from "@shared/lib/decoration-preference";
import { THEME_PRESETS } from "@shared/lib/theme-presets";
import { Segmented, Switch } from "@violet/ui";
import { useId } from "react";

/** 独立装饰季节与图层开关，桌面和移动端使用同一份配置内容。 */
export function DecorationPicker({ className }: { className?: string }) {
	const { preference, season, layers, switchDecoration, setLayer } = useDecorationSwitcher();
	const id = useId();

	return (
		<div className={className}>
			<div className="mb-2 flex items-center justify-between gap-3">
				<h3 className="text-xs font-medium text-muted-foreground">季节装饰</h3>
				<span className="text-[11px] text-muted-foreground">
					{season ? themeChoiceTitle(season) : "已关闭"}
				</span>
			</div>
			<Segmented
				aria-label="装饰"
				value={preference}
				onValueChange={(choice) => void switchDecoration(choice)}
				segments={DECORATION_PREFERENCES.map((choice) => ({
					value: choice,
					label:
						choice === "theme"
							? "跟随"
							: choice === "none"
								? "无"
								: THEME_PRESETS[choice].label,
					title: decorationChoiceTitle(choice),
				}))}
				block
				itemClassName="px-1 text-xs"
			/>
			<fieldset className="mt-3 grid grid-cols-3 gap-3 rounded-xl bg-muted/40 px-3 py-2.5">
				<legend className="sr-only">装饰图层</legend>
				{DECORATION_LAYERS.map((layer) => (
					<div key={layer} className="flex items-center justify-between gap-2">
						<label htmlFor={`${id}-${layer}`} className="cursor-pointer text-xs">
							{DECORATION_LAYER_LABELS[layer]}
						</label>
						<Switch
							id={`${id}-${layer}`}
							size="sm"
							checked={layers[layer]}
							onCheckedChange={(enabled) => void setLayer(layer, enabled)}
							className="shadow-none"
						/>
					</div>
				))}
			</fieldset>
		</div>
	);
}
