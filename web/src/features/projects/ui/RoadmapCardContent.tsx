import { Badge } from "@violet/ui";
import type { RoadmapItem } from "../model/roadmap";

/** 卡片上最多显示几个标签，其余折成「+N」。 */
const VISIBLE_TAGS = 3;

export interface RoadmapCardContentProps {
	item: RoadmapItem;
	/** 打开条目详情；`trigger` 是被点击的按钮，弹窗关闭后焦点要还给它。 */
	onOpen: (item: RoadmapItem, trigger: HTMLElement) => void;
}

/**
 * 看板卡片的内容：编号、标题、标签与交付信息。
 *
 * 点击入口是里面的按钮：可编辑看板里卡片本身的 Enter 是「拿起」，打开详情不能占用它。
 */
export function RoadmapCardContent({ item, onOpen }: RoadmapCardContentProps) {
	const hiddenTags = item.tags.length - VISIBLE_TAGS;
	const delivered = [item.delivered_version, item.completion_date].filter(Boolean).join(" · ");
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
			{item.tags.length > 0 ? (
				<span className="mt-2 flex flex-wrap gap-1">
					{item.tags.slice(0, VISIBLE_TAGS).map((tag) => (
						<Badge key={tag} variant="secondary" className="max-w-full truncate">
							{tag}
						</Badge>
					))}
					{hiddenTags > 0 ? <Badge variant="outline">+{hiddenTags}</Badge> : null}
				</span>
			) : null}
			{delivered ? (
				<span className="mt-2 block font-mono text-xs text-muted-foreground">
					{delivered}
				</span>
			) : null}
		</button>
	);
}
