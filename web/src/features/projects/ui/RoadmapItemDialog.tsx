import {
	Badge,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@violet/ui";
import { ExternalLink } from "lucide-react";
import { ROADMAP_STAGE_LABELS } from "../lib/roadmap-board";
import type { RoadmapItem } from "../model/roadmap";

export interface RoadmapItemDialogProps {
	/** 要显示的条目；关闭的淡出期间仍要给着它，内容才不会先消失。 */
	item: RoadmapItem | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 弹窗关闭后焦点还给谁；Radix 只会还给 DialogTrigger，受控的弹窗要自己处理。 */
	returnFocusTo?: () => HTMLElement | null;
}

/** 条目的只读详情弹窗：简介、标签、交付版本、完成日期与关联链接，淡入淡出。 */
export function RoadmapItemDialog({
	item,
	open,
	onOpenChange,
	returnFocusTo,
}: RoadmapItemDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				// 没有简介时没有可关联的描述，显式声明免得 Radix 警告
				{...(item?.description ? {} : { "aria-describedby": undefined })}
				className="max-h-[calc(100dvh-4rem)] gap-5 overflow-y-auto sm:max-w-xl"
				onCloseAutoFocus={(event) => {
					const target = returnFocusTo?.();
					if (!target?.isConnected) return;
					event.preventDefault();
					target.focus();
				}}
			>
				{item ? (
					<>
						<DialogHeader>
							<p className="font-mono text-xs text-muted-foreground">
								#{item.number} · {ROADMAP_STAGE_LABELS[item.stage]}
							</p>
							<DialogTitle className="text-xl leading-snug">{item.title}</DialogTitle>
							{item.description ? (
								<DialogDescription className="whitespace-pre-wrap">
									{item.description}
								</DialogDescription>
							) : null}
						</DialogHeader>
						{item.tags.length > 0 ? (
							<ul className="flex flex-wrap gap-1.5" aria-label="条目标签">
								{item.tags.map((tag) => (
									<li key={tag}>
										<Badge variant="secondary">{tag}</Badge>
									</li>
								))}
							</ul>
						) : null}
						{item.delivered_version || item.completion_date ? (
							<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
								{item.delivered_version ? (
									<>
										<dt className="text-muted-foreground">交付版本</dt>
										<dd className="font-mono">{item.delivered_version}</dd>
									</>
								) : null}
								{item.completion_date ? (
									<>
										<dt className="text-muted-foreground">完成日期</dt>
										<dd className="font-mono">{item.completion_date}</dd>
									</>
								) : null}
							</dl>
						) : null}
						{item.links.length > 0 ? (
							<ul className="space-y-1.5 text-sm" aria-label="关联链接">
								{item.links.map((link) => (
									<li key={`${link.label}\u0000${link.url}`}>
										<a
											href={link.url}
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
										>
											<ExternalLink className="size-3.5" aria-hidden="true" />
											{link.label || link.url}
										</a>
									</li>
								))}
							</ul>
						) : null}
					</>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
