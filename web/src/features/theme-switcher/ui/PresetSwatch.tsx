import type { Season } from "@shared/lib/theme-preference";
import { cn } from "cn";

/** 预设主题的品牌实色圆点；`data-theme` 让圆点按该预设重新求值语义色。 */
export function PresetSwatch({ season, className }: { season: Season; className?: string }) {
	return (
		<span
			aria-hidden
			data-theme={season}
			className={cn(
				"inline-block shrink-0 rounded-full bg-decoration ring-1 ring-edge-hairline ring-inset",
				className,
			)}
		/>
	);
}
