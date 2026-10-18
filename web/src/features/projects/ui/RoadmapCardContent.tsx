import { checklistProgress } from "../lib/roadmap-checklist";
import type { RoadmapItem } from "../model/roadmap";
import { ChecklistMeter } from "./ChecklistMeter";

/** 卡片上最多显示几个标签，其余折成「+N」。 */
const VISIBLE_TAGS = 3;

const PILL = "max-w-full truncate rounded-full px-2 text-[11px] leading-5";

export interface RoadmapCardContentProps {
	item: RoadmapItem;
	/** 打开条目详情；`trigger` 是被点击的按钮，弹窗关闭后焦点要还给它。 */
	onOpen: (item: RoadmapItem, trigger: HTMLElement) => void;
}

/**
 * 看板卡片的内容：标题、阻塞与标签胶囊，底部是编号与子项进度（已完成的是交付信息）。
 *
 * 编号在 DOM 里排第一，读屏与按钮名称先听到「#12」，视觉上落在卡片底部。
 * 点击入口是里面的按钮：可编辑看板里卡片本身的 Enter 是「拿起」，打开详情不能占用它。
 */
export function RoadmapCardContent({ item, onOpen }: RoadmapCardContentProps) {
	const hiddenTags = item.tags.length - VISIBLE_TAGS;
	const delivered = [item.delivered_version, item.completion_date].filter(Boolean).join(" · ");
	const checklist = item.checklist.length > 0 ? checklistProgress(item.checklist) : null;
	const showPills = item.blocked || item.tags.length > 0;
	return (
		<button
			type="button"
			aria-haspopup="dialog"
			onClick={(event) => onOpen(item, event.currentTarget)}
			className="grid w-full cursor-pointer grid-cols-[auto_1fr] items-center gap-x-3 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			<span className="col-start-1 row-start-3 mt-3 font-mono text-xs text-muted-foreground tabular-nums">
				#{item.number}
			</span>
			<span className="col-span-2 row-start-1 line-clamp-2 font-reading text-sm leading-snug font-medium">
				{item.title}
			</span>
			{showPills ? (
				<span className="col-span-2 row-start-2 mt-2.5 flex flex-wrap gap-1">
					{item.blocked ? (
						// 阻塞靠文字说明，颜色只是加强
						<span className={`${PILL} bg-destructive/10 text-destructive`}>被阻塞</span>
					) : null}
					{item.tags.slice(0, VISIBLE_TAGS).map((tag) => (
						<span key={tag} className={`${PILL} bg-muted text-muted-foreground`}>
							{tag}
						</span>
					))}
					{hiddenTags > 0 ? (
						<span className={`${PILL} bg-muted text-muted-foreground`}>
							+{hiddenTags}
						</span>
					) : null}
				</span>
			) : null}
			{delivered ? (
				<span className="col-start-2 row-start-3 mt-3 justify-self-end font-mono text-xs text-muted-foreground">
					{delivered}
				</span>
			) : checklist ? (
				<ChecklistMeter
					progress={checklist}
					className="col-start-2 row-start-3 mt-3 justify-self-end text-xs text-muted-foreground"
				/>
			) : null}
		</button>
	);
}
