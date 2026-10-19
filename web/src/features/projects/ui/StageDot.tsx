import type { RoadmapStage } from "../model/roadmap";

/** 阶段的颜色记号，与看板列头的圆点一致：空心圈是计划中，品牌色是进行中，成功色是已完成。 */
const STAGE_DOT: Record<RoadmapStage, string> = {
	planned: "border-[1.5px] border-muted-foreground",
	in_progress: "bg-primary",
	completed: "bg-success",
};

/** 阶段圆点，只是装饰；阶段名要另外用文字写出来。 */
export function StageDot({ stage, className }: { stage: RoadmapStage; className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={`inline-block size-2 shrink-0 rounded-full ${STAGE_DOT[stage]} ${className ?? ""}`}
		/>
	);
}
