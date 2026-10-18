import { Button } from "@violet/ui";
import { Circle, CircleCheck } from "lucide-react";
import { useId, useState } from "react";
import { checklistProgress } from "../lib/roadmap-checklist";
import type { RoadmapChecklistItem } from "../model/roadmap";
import { ChecklistMeter } from "./ChecklistMeter";

/** 超过这个数量且有已完成项时，提供「隐藏已完成」，免得长清单里未完成的被淹没。 */
const COLLAPSIBLE_FROM = 6;

export interface RoadmapChecklistProps {
	checklist: readonly RoadmapChecklistItem[];
}

/** 条目详情里的子项清单：只读，长清单在区域内滚动，可只看未完成的。 */
export function RoadmapChecklist({ checklist }: RoadmapChecklistProps) {
	const headingId = useId();
	const [hideDone, setHideDone] = useState(false);
	const progress = checklistProgress(checklist);
	const canHide = checklist.length >= COLLAPSIBLE_FROM && progress.done > 0;
	const hiding = hideDone && canHide;
	const shown = hiding ? checklist.filter((entry) => !entry.done) : checklist;
	return (
		<section aria-labelledby={headingId} className="space-y-2">
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
				<div className="flex items-center gap-3">
					<h3 id={headingId} className="text-sm text-muted-foreground">
						子项
					</h3>
					<ChecklistMeter progress={progress} className="text-xs text-muted-foreground" />
				</div>
				{canHide ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						aria-pressed={hiding}
						onClick={() => setHideDone((value) => !value)}
					>
						{hiding ? `显示已完成（${progress.done}）` : "隐藏已完成"}
					</Button>
				) : null}
			</div>
			{/* 长清单在这里滚动：可滚动区域要能被键盘聚焦，焦点环留在内边距里不被裁掉 */}
			<div
				role="region"
				aria-label="子项清单"
				// biome-ignore lint/a11y/noNoninteractiveTabindex: 可滚动区域需要键盘可达
				tabIndex={0}
				className="-m-1 max-h-72 overflow-y-auto rounded-md p-1 focus-visible:outline-2 focus-visible:outline-ring"
			>
				<ul className="space-y-1.5 font-reading text-sm leading-relaxed">
					{shown.map((entry, index) => (
						// 子项没有稳定标识，清单整体替换，用位置当 key
						<li key={index} className="flex items-start gap-2">
							{entry.done ? (
								<CircleCheck
									className="mt-0.5 size-4 shrink-0 text-primary"
									aria-hidden="true"
								/>
							) : (
								<Circle
									className="mt-0.5 size-4 shrink-0 text-muted-foreground"
									aria-hidden="true"
								/>
							)}
							<span className={entry.done ? "text-muted-foreground" : undefined}>
								<span className="sr-only">
									{entry.done ? "已完成：" : "未完成："}
								</span>
								{entry.text}
							</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
