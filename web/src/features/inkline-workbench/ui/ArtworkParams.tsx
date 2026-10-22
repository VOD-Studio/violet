import { Segmented } from "@violet/ui";
import type { ScheduleMode } from "@violetjs/inkline";
import { ARTWORKS, type ArtworkKey } from "../model/artworks";
import { useWorkbenchStore } from "../model/workbench-store";

const MODES: { value: ScheduleMode; label: string }[] = [
	{ value: "sequential", label: "顺序" },
	{ value: "stagger", label: "交错" },
	{ value: "parallel", label: "并行" },
];

const RATES = ["0.5", "1", "2", "4"] as const;

/** 画稿、编排方式与播放倍率；导出沿用这里的画稿与编排。 */
export function ArtworkParams() {
	const artwork = useWorkbenchStore((s) => s.artwork);
	const mode = useWorkbenchStore((s) => s.mode);
	const rate = useWorkbenchStore((s) => s.rate);
	const set = useWorkbenchStore((s) => s.set);
	return (
		<div className="grid gap-5">
			<div className="grid gap-1.5">
				<span className="text-xs text-muted-foreground">画稿</span>
				<Segmented<ArtworkKey>
					aria-label="画稿"
					block
					value={artwork}
					onValueChange={(value) => set({ artwork: value })}
					segments={ARTWORKS.map(({ key, label }) => ({ value: key, label }))}
				/>
			</div>
			<div className="grid gap-1.5">
				<span className="text-xs text-muted-foreground">编排</span>
				<Segmented<ScheduleMode>
					aria-label="编排"
					block
					value={mode}
					onValueChange={(value) => set({ mode: value })}
					segments={MODES}
				/>
				<p className="text-xs leading-relaxed text-muted-foreground">
					顺序：图元依次落笔；交错：按顺序错开起笔、彼此重叠；并行：同时开始、同时结束。咖啡少女分底纸、线稿、上色三段，段内按所选方式编排。
				</p>
			</div>
			<div className="grid gap-1.5">
				<span className="text-xs text-muted-foreground">播放倍率（不影响导出）</span>
				<Segmented<(typeof RATES)[number]>
					aria-label="播放倍率"
					block
					value={String(rate) as (typeof RATES)[number]}
					onValueChange={(value) => set({ rate: Number(value) })}
					segments={RATES.map((value) => ({ value, label: `${value}×` }))}
				/>
			</div>
		</div>
	);
}
