import { useDecorationSwitcher } from "@features/seasonal-decor/hooks/useDecorationSwitcher";
import { DECORATION_LAYERS, DECORATION_PREFERENCES } from "@shared/lib/decoration-preference";
import { THEME_PRESETS } from "@shared/lib/theme-presets";
import { Checkbox } from "@violet/ui";
import { cn } from "cn";
import { useId } from "react";

import { DECORATION_LAYER_LABELS, decorationChoiceTitle } from "../model/choices";

/** 移动端主题选项下的独立装饰偏好和图层开关。 */
export function DecorationPicker({ className }: { className?: string }) {
	const { preference, layers, switchDecoration, setLayer } = useDecorationSwitcher();
	const id = useId();

	return (
		<div className={className}>
			<p className="mb-2 px-1 text-xs text-muted-foreground">装饰</p>
			<div role="radiogroup" aria-label="装饰" className="grid grid-cols-6 gap-1">
				{DECORATION_PREFERENCES.map((choice) => (
					<button
						key={choice}
						type="button"
						role="radio"
						aria-checked={preference === choice}
						aria-label={decorationChoiceTitle(choice)}
						onClick={() => void switchDecoration(choice)}
						className={cn(
							"flex min-h-10 items-center justify-center rounded-xl px-1 py-2 text-xs transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
							preference === choice
								? "bg-selected text-selected-foreground"
								: "text-muted-foreground hover:bg-muted hover:text-foreground",
						)}
					>
						{choice === "theme" || choice === "none"
							? decorationChoiceTitle(choice)
							: THEME_PRESETS[choice].label}
					</button>
				))}
			</div>
			<fieldset className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 p-1">
				<legend className="sr-only">装饰图层</legend>
				{DECORATION_LAYERS.map((layer) => (
					<div key={layer} className="flex items-center gap-1.5">
						<Checkbox
							id={`${id}-${layer}`}
							size="sm"
							checked={layers[layer]}
							onCheckedChange={(enabled) => void setLayer(layer, enabled === true)}
						/>
						<label
							htmlFor={`${id}-${layer}`}
							className="cursor-pointer text-xs text-muted-foreground"
						>
							{DECORATION_LAYER_LABELS[layer]}
						</label>
					</div>
				))}
			</fieldset>
		</div>
	);
}
