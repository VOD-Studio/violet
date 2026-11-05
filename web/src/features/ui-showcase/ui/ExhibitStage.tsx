import type { Exhibit } from "../model/exhibit";

export interface ExhibitStageProps {
	exhibit: Exhibit;
	state: string;
	/** 叠加虚线占地框与尺寸 */
	outline: boolean;
}

/** 按占地固定尺寸的舞台；内容超出会让外层展柜出现可测量的溢出。 */
export function ExhibitStage({ exhibit, state, outline }: ExhibitStageProps) {
	const { width, height } = exhibit.footprint;
	const { Render } = exhibit;
	return (
		<div data-stage="" className="relative shrink-0" style={{ width, height }}>
			{Render ? (
				<Render state={state} />
			) : (
				<div className="flex size-full flex-col items-center justify-center gap-1 rounded-xl bg-muted/70 text-muted-foreground">
					<span className="text-14">待建</span>
					{exhibit.issue !== undefined && (
						<span className="font-mono text-12">#{exhibit.issue}</span>
					)}
				</div>
			)}
			{outline && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 outline-1 outline-decoration outline-dashed"
				>
					<span className="absolute right-0 bottom-full mb-1 font-mono text-12 text-muted-foreground">
						{width} × {height}
					</span>
				</div>
			)}
		</div>
	);
}
