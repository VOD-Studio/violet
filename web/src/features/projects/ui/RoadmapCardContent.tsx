import { Lock } from "lucide-react";
import { checklistProgress } from "../lib/roadmap-checklist";
import type { RoadmapItem } from "../model/roadmap";
import { ChecklistMeter } from "./ChecklistMeter";

/** 卡片上最多显示几个标签，其余折成「+N」。 */
const VISIBLE_TAGS = 3;

export interface RoadmapCardContentProps {
	item: RoadmapItem;
	/** 打开条目详情；`trigger` 是被点击的按钮，弹窗关闭后焦点要还给它。 */
	onOpen: (item: RoadmapItem, trigger: HTMLElement) => void;
}

/**
 * 看板卡片的内容：编号、标题，以及阻塞、子项进度、标签与交付信息。
 *
 * 点击入口是里面的按钮：可编辑看板里卡片本身的 Enter 是「拿起」，打开详情不能占用它。
 */
export function RoadmapCardContent({ item, onOpen }: RoadmapCardContentProps) {
	const hiddenTags = item.tags.length - VISIBLE_TAGS;
	const delivered = [item.delivered_version, item.completion_date].filter(Boolean).join(" · ");
	const checklist = item.checklist.length > 0 ? checklistProgress(item.checklist) : null;
	const showMeta = item.blocked || checklist !== null || item.tags.length > 0;
	return (
		<button
			type="button"
			aria-haspopup="dialog"
			onClick={(event) => onOpen(item, event.currentTarget)}
			className="block w-full cursor-pointer rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			<span className="flex items-baseline gap-2">
				<span className="font-mono text-xs text-muted-foreground tabular-nums">
					#{item.number}
				</span>
				<span className="min-w-0 flex-1 text-sm leading-snug font-medium">
					{item.title}
				</span>
			</span>
			{showMeta ? (
				<span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
					{item.blocked ? (
						// 阻塞靠文字说明，颜色只是加强
						<span className="inline-flex items-center gap-1 text-destructive">
							<Lock className="size-3" aria-hidden="true" />
							被阻塞
						</span>
					) : null}
					{checklist ? <ChecklistMeter progress={checklist} /> : null}
					{item.tags.length > 0 ? (
						<span className="flex min-w-0 flex-wrap items-center gap-x-2">
							{item.tags.slice(0, VISIBLE_TAGS).map((tag) => (
								<span
									key={tag}
									className="max-w-full truncate not-last:after:ml-2 not-last:after:content-['·']"
								>
									{tag}
								</span>
							))}
							{hiddenTags > 0 ? <span>+{hiddenTags}</span> : null}
						</span>
					) : null}
				</span>
			) : null}
			{delivered ? (
				<span className="mt-1.5 block font-mono text-xs text-muted-foreground">
					{delivered}
				</span>
			) : null}
		</button>
	);
}
