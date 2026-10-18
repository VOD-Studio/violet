import {
	Badge,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@violet/ui";
import { ExternalLink, Lock } from "lucide-react";
import { useId } from "react";
import { ROADMAP_STAGE_LABELS } from "../lib/roadmap-board";
import { relationGroups } from "../lib/roadmap-relations";
import type { RoadmapItem, RoadmapRelation } from "../model/roadmap";
import { RoadmapChecklist } from "./RoadmapChecklist";

export interface RoadmapItemDialogProps {
	/** 要显示的条目；关闭的淡出期间仍要给着它，内容才不会先消失。 */
	item: RoadmapItem | null;
	/** 项目的全部条目与关系：用来列出这个条目的关系，关系另一端的条目按编号与标题显示。 */
	items: readonly RoadmapItem[];
	relations: readonly RoadmapRelation[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 弹窗关闭后焦点还给谁；Radix 只会还给 DialogTrigger，受控的弹窗要自己处理。 */
	returnFocusTo?: () => HTMLElement | null;
}

/** 条目的只读详情弹窗：简介、子项清单、关系、标签、交付信息与关联链接，淡入淡出。 */
export function RoadmapItemDialog({
	item,
	items,
	relations,
	open,
	onOpenChange,
	returnFocusTo,
}: RoadmapItemDialogProps) {
	const relationsHeadingId = useId();
	const groups = item ? relationGroups(item.id, items, relations) : [];
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				// 没有简介时没有可关联的描述，显式声明免得 Radix 警告
				{...(item?.description ? {} : { "aria-describedby": undefined })}
				className="max-h-[calc(100dvh-4rem)] gap-6 overflow-y-auto sm:max-w-xl"
				onCloseAutoFocus={(event) => {
					const target = returnFocusTo?.();
					if (!target?.isConnected) return;
					event.preventDefault();
					target.focus();
				}}
			>
				{item ? (
					<>
						<DialogHeader className="gap-2">
							<p className="font-mono text-xs text-muted-foreground">
								#{item.number} · {ROADMAP_STAGE_LABELS[item.stage]}
							</p>
							<DialogTitle className="font-reading text-xl leading-snug">
								{item.title}
							</DialogTitle>
							{item.blocked ? (
								<p className="flex items-center gap-1.5 text-sm text-destructive">
									<Lock className="size-3.5 shrink-0" aria-hidden="true" />
									被阻塞：还有未完成的前置条目
								</p>
							) : null}
							{item.description ? (
								<DialogDescription className="font-reading leading-relaxed whitespace-pre-wrap text-foreground/80">
									{item.description}
								</DialogDescription>
							) : null}
						</DialogHeader>
						{item.checklist.length > 0 ? (
							<RoadmapChecklist
								// 换一个条目就重新开始：上一个条目的「隐藏已完成」不该带过来
								key={item.id}
								checklist={item.checklist}
							/>
						) : null}
						{groups.length > 0 ? (
							<section aria-labelledby={relationsHeadingId} className="space-y-2">
								<h3
									id={relationsHeadingId}
									className="text-sm text-muted-foreground"
								>
									关系
								</h3>
								<dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
									{groups.map((group) => (
										<div key={group.key} className="contents">
											<dt className="whitespace-nowrap text-muted-foreground">
												{group.label}
											</dt>
											<dd>
												<ul className="space-y-1">
													{group.items.map((other) => (
														<li key={other.id} className="font-reading">
															<span className="mr-1.5 font-mono text-xs text-muted-foreground">
																#{other.number}
															</span>
															{other.title}
															<span className="ml-2 text-xs text-muted-foreground">
																{ROADMAP_STAGE_LABELS[other.stage]}
															</span>
														</li>
													))}
												</ul>
											</dd>
										</div>
									))}
								</dl>
							</section>
						) : null}
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
