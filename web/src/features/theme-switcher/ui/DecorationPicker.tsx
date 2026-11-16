import { useDecorationSwitcher } from "@features/seasonal-decor/hooks/useDecorationSwitcher";
import {
	DECORATION_LAYER_LABELS,
	decorationChoiceTitle,
} from "@features/theme-switcher/model/choices";
import { DECORATION_LAYERS } from "@shared/lib/decoration-preference";
import { resolvePresetTheme, SEASONS, type Season } from "@shared/lib/theme-preference";
import { THEME_PRESETS } from "@shared/lib/theme-presets";
import { Switch } from "@violet/ui";
import { RadioGroup } from "radix-ui";
import { useEffect, useId, useRef } from "react";
import { ThemeSwatch } from "./ThemeSwatch";

/** 独立装饰季节与图层开关，桌面和移动端使用同一份配置内容。 */
export function DecorationPicker({ className }: { className?: string }) {
	const { preference, season, layers, switchDecoration, setLayer } = useDecorationSwitcher();
	const id = useId();
	const independent = preference !== "theme" && preference !== "none";
	const lastSeason = useRef<Season | null>(independent ? preference : null);
	useEffect(() => {
		if (preference !== "theme" && preference !== "none") lastSeason.current = preference;
	}, [preference]);

	function selectMode(mode: string) {
		if (independent) lastSeason.current = preference;
		if (mode === "theme" || mode === "none") {
			void switchDecoration(mode);
		} else if (mode === "independent") {
			void switchDecoration(
				lastSeason.current ?? season ?? resolvePresetTheme("follow", new Date()),
			);
		}
	}

	return (
		<section aria-label="季节装饰" className={className}>
			<div className="mb-2 flex items-center justify-between gap-3">
				<h3 className="text-xs font-medium text-muted-foreground">季节装饰</h3>
				<span className="text-xs text-muted-foreground">
					{preference === "theme"
						? season
							? `随主题 · ${THEME_PRESETS[season].name}`
							: "自定义主题 · 无装饰"
						: preference === "none"
							? "已关闭"
							: THEME_PRESETS[preference].name}
				</span>
			</div>
			<RadioGroup.Root
				aria-label="装饰"
				value={independent ? "independent" : preference}
				onValueChange={selectMode}
				className="grid grid-cols-3 gap-2"
			>
				{[
					{ value: "theme", label: "跟随", name: "跟随主题" },
					{ value: "none", label: "关闭", name: "关闭装饰" },
					{ value: "independent", label: "独立", name: "独立设置" },
				].map((mode) => (
					<RadioGroup.Item
						key={mode.value}
						value={mode.value}
						aria-label={mode.name}
						className="flex min-h-9 items-center justify-center rounded-lg border border-border px-2 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=checked]:border-muted-foreground data-[state=checked]:bg-muted data-[state=checked]:font-medium"
					>
						{mode.label}
					</RadioGroup.Item>
				))}
			</RadioGroup.Root>
			{independent && (
				<RadioGroup.Root
					aria-label="装饰季节"
					value={preference}
					className="mt-2 grid grid-cols-4 gap-2"
				>
					{SEASONS.map((choice) => (
						<RadioGroup.Item
							key={choice}
							value={choice}
							aria-label={decorationChoiceTitle(choice)}
							onClick={() => void switchDecoration(choice)}
							className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-1 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=checked]:border-muted-foreground data-[state=checked]:bg-muted data-[state=checked]:font-medium"
						>
							<ThemeSwatch theme={choice} className="size-2" />
							{THEME_PRESETS[choice].name}
						</RadioGroup.Item>
					))}
				</RadioGroup.Root>
			)}
			<fieldset disabled={!season} className="mt-2 disabled:opacity-50">
				<legend className="sr-only">装饰图层</legend>
				{DECORATION_LAYERS.map((layer) => (
					<div
						key={layer}
						className="flex min-h-9 items-center justify-between gap-4 px-1"
					>
						<label htmlFor={`${id}-${layer}`} className="flex-1 cursor-pointer text-sm">
							{DECORATION_LAYER_LABELS[layer]}
						</label>
						<Switch
							id={`${id}-${layer}`}
							size="sm"
							checked={layers[layer]}
							disabled={!season}
							onCheckedChange={(enabled) => void setLayer(layer, enabled)}
							className="shadow-none"
						/>
					</div>
				))}
			</fieldset>
		</section>
	);
}
