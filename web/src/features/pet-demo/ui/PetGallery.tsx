import { Segmented } from "@violet/ui";
import { useEffect, useState } from "react";
import { SPECIES_NAMES, STAGE_NAMES } from "../model/labels";
import type { Pose, Sprite } from "../model/types";
import { PetScene } from "./PetScene";

const FRAME_MS = 400;

const POSES: { value: Pose; label: string }[] = [
	{ value: "idle", label: "待机" },
	{ value: "eat", label: "进食" },
	{ value: "play", label: "玩耍" },
	{ value: "sleep", label: "睡觉" },
	{ value: "startled", label: "受惊" },
	{ value: "sick", label: "生病" },
	{ value: "evolve", label: "进化" },
	{ value: "end", label: "离世" },
];

const STAGES = Object.entries(STAGE_NAMES).map(([value, label]) => ({ value, label }));

interface PetGalleryProps {
	render: (species: number, pose: Pose, stage: number, t: number) => Sprite | null;
}

/** 图鉴:全部物种在任一姿态与成长阶段下的像素形象,与上方主宠由同一个规则核心合成。 */
export function PetGallery({ render }: PetGalleryProps) {
	const [pose, setPose] = useState<Pose>("idle");
	const [stage, setStage] = useState("baby");
	const [t, setT] = useState(0);

	useEffect(() => {
		const id = setInterval(() => setT((n) => n + 1), FRAME_MS);
		return () => clearInterval(id);
	}, []);

	const stageIndex = Object.keys(STAGE_NAMES).indexOf(stage);

	return (
		<section className="space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h2 className="text-xl font-semibold tracking-tight">图鉴</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{SPECIES_NAMES.length} 个物种，每个都有完整的动作。
					</p>
				</div>
				<Segmented
					variant="line"
					value={stage}
					onValueChange={setStage}
					segments={STAGES}
					aria-label="成长阶段"
				/>
			</div>
			<Segmented
				variant="line"
				value={pose}
				onValueChange={(v) => setPose(v as Pose)}
				segments={POSES}
				aria-label="姿态"
			/>
			<ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{SPECIES_NAMES.map((name, species) => {
					const sprite = render(species, pose, stageIndex, t);
					return (
						<li key={name} className="rounded-2xl px-2 pt-4 pb-3 ring-1 ring-border">
							{sprite ? <PetScene sprite={sprite} label={name} /> : null}
							<p className="mt-2 text-center text-sm">{name}</p>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
