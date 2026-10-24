import { InlineEdit } from "@violetjs/kanban/unstyled";
import { checklistProgress } from "../lib/roadmap-checklist";
import type { RoadmapItem } from "../model/roadmap";
import { ChecklistMeter } from "./ChecklistMeter";

/** 卡片上最多显示几个标签，其余折成「+N」。 */
const VISIBLE_TAGS = 3;

const PILL = "max-w-full truncate rounded-full px-2 text-[11px] leading-5";
const FOCUS =
	"rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const TITLE = "font-reading text-sm leading-snug font-medium";

export interface RoadmapCardContentProps {
	item: RoadmapItem;
	/** 打开条目详情；`trigger` 是被点击的按钮，弹窗关闭后焦点要还给它。 */
	onOpen: (item: RoadmapItem, trigger: HTMLElement) => void;
	/**
	 * 保存新标题；给出时标题可以点开就地修改，标题以下的区域打开详情。
	 * 失败时抛出，编辑框留着草稿并提示。
	 */
	onRename?: (item: RoadmapItem, title: string) => Promise<void>;
}

/** 阻塞与标签胶囊；没有时为 null。 */
function Pills({ item }: { item: RoadmapItem }) {
	if (!item.blocked && item.tags.length === 0) return null;
	const hiddenTags = item.tags.length - VISIBLE_TAGS;
	return (
		<span className="flex flex-wrap gap-1">
			{item.blocked ? (
				// 阻塞靠文字说明，颜色只是加强
				<span className={`${PILL} bg-destructive/10 text-destructive-text`}>被阻塞</span>
			) : null}
			{item.tags.slice(0, VISIBLE_TAGS).map((tag) => (
				<span key={tag} className={`${PILL} bg-muted text-muted-foreground`}>
					{tag}
				</span>
			))}
			{hiddenTags > 0 ? (
				<span className={`${PILL} bg-muted text-muted-foreground`}>+{hiddenTags}</span>
			) : null}
		</span>
	);
}

/** 卡片底部右侧：已完成的是交付信息，其余是子项进度；都没有时为 null。 */
function Footnote({ item, className }: { item: RoadmapItem; className: string }) {
	const delivered = [item.delivered_version, item.completion_date].filter(Boolean).join(" · ");
	if (delivered) return <span className={`font-mono ${className}`}>{delivered}</span>;
	if (item.checklist.length === 0) return null;
	return <ChecklistMeter progress={checklistProgress(item.checklist)} className={className} />;
}

/**
 * 看板卡片的内容：标题、阻塞与标签胶囊，底部是编号与子项进度（已完成的是交付信息）。
 *
 * 编号在 DOM 里排第一，读屏与按钮名称先听到「#12」，视觉上落在卡片底部。
 * 点击入口是里面的按钮：可编辑看板里卡片本身的 Enter 是「拿起」，打开详情不能占用它。
 */
export function RoadmapCardContent({ item, onOpen, onRename }: RoadmapCardContentProps) {
	const open = (event: { currentTarget: HTMLElement }) => onOpen(item, event.currentTarget);
	const footnote = "justify-self-end text-xs text-muted-foreground";

	if (onRename) {
		return (
			<div className="grid gap-2.5">
				<InlineEdit
					value={item.title}
					label={`#${item.number} 的标题`}
					maxLength={200}
					onSave={(title) => onRename(item, title)}
					className={TITLE}
				/>
				<button
					type="button"
					aria-haspopup="dialog"
					aria-label={`查看 #${item.number} ${item.title} 的详情`}
					onClick={open}
					className={`grid w-full cursor-pointer grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3 text-left ${FOCUS}`}
				>
					<span className="col-span-2 empty:hidden">
						<Pills item={item} />
					</span>
					<span className="font-mono text-xs text-muted-foreground tabular-nums">
						#{item.number}
					</span>
					<Footnote item={item} className={footnote} />
				</button>
			</div>
		);
	}

	return (
		<button
			type="button"
			aria-haspopup="dialog"
			onClick={open}
			className={`grid w-full cursor-pointer grid-cols-[auto_1fr] items-center gap-x-3 text-left ${FOCUS}`}
		>
			<span className="col-start-1 row-start-3 mt-3 font-mono text-xs text-muted-foreground tabular-nums">
				#{item.number}
			</span>
			<span className={`col-span-2 row-start-1 line-clamp-2 ${TITLE}`}>{item.title}</span>
			<span className="col-span-2 row-start-2 mt-2.5 empty:hidden">
				<Pills item={item} />
			</span>
			<Footnote item={item} className={`col-start-2 row-start-3 mt-3 ${footnote}`} />
		</button>
	);
}
