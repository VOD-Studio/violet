import { SEASONS, type Season } from "@shared/lib/theme-preference";
import { THEME_PRESETS } from "@shared/lib/theme-presets";
import { Button, Segmented, type SegmentedItem } from "@violet/ui";
import { cn } from "cn";
import type { ShowcaseSearch } from "../model/search";

const SEASON_SEGMENTS: SegmentedItem<Season | "">[] = SEASONS.map((season) => ({
	value: season,
	label: THEME_PRESETS[season].name,
	title: `${THEME_PRESETS[season].label} · ${THEME_PRESETS[season].name}`,
}));

const MODE_SEGMENTS = [
	{ value: "light", label: "浅色" },
	{ value: "dark", label: "深色" },
] as const;

export interface ShowcaseToolbarProps {
	/** 实际生效的季节；站点用自定义主题且未选季节时为空串 */
	season: Season | "";
	mode: "light" | "dark";
	outline: boolean;
	reduced: boolean;
	onChange: (patch: Partial<ShowcaseSearch>) => void;
	className?: string;
}

/** 季节、明暗、占地框与减弱动态；陈列室与检视台共用同一组 URL 状态。 */
export function ShowcaseToolbar({
	season,
	mode,
	outline,
	reduced,
	onChange,
	className,
}: ShowcaseToolbarProps) {
	return (
		<div className={cn("flex flex-wrap items-center gap-x-4 gap-y-3", className)}>
			<Segmented
				aria-label="季节"
				size="sm"
				value={season}
				onValueChange={(value) => onChange({ season: value || undefined })}
				segments={SEASON_SEGMENTS}
			/>
			<Segmented
				aria-label="明暗"
				size="sm"
				value={mode}
				onValueChange={(value) => onChange({ mode: value })}
				segments={[...MODE_SEGMENTS]}
			/>
			<div className="flex items-center gap-2">
				<Button
					size="sm"
					variant={outline ? "default" : "secondary"}
					aria-pressed={outline}
					onClick={() => onChange({ outline: !outline || undefined })}
				>
					占地框
				</Button>
				<Button
					size="sm"
					variant={reduced ? "default" : "secondary"}
					aria-pressed={reduced}
					onClick={() => onChange({ reduced: !reduced || undefined })}
				>
					减弱动态
				</Button>
			</div>
		</div>
	);
}
