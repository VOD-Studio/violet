import {
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@violet/ui";
import { ExternalLink, Lock, Pencil, Trash2, X } from "lucide-react";
import { useId, useState } from "react";
import { ROADMAP_STAGE_LABELS } from "../lib/roadmap-board";
import type { RoadmapContentInput } from "../lib/roadmap-content";
import { relationGroups } from "../lib/roadmap-relations";
import type { RoadmapItem, RoadmapRelation, RoadmapRelationType } from "../model/roadmap";
import { RoadmapChecklist } from "./RoadmapChecklist";
import { RoadmapItemForm } from "./RoadmapItemForm";
import { RoadmapRelationForm } from "./RoadmapRelationForm";

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
	/** 保存编辑后的内容；给出时弹窗底部有「编辑」。失败时抛出，表单留着草稿并显示原因。 */
	onSave?: (item: RoadmapItem, content: RoadmapContentInput) => Promise<void>;
	/** 删除条目；给出时弹窗底部有「删除」，不再二次确认，由调用方提供撤销。 */
	onDelete?: (item: RoadmapItem) => void;
	/** 建立关系；给出时「关系」区可以搜索条目来建立。被拒绝时抛出，错误信息说明原因。 */
	onRelate?: (input: {
		source_id: string;
		target_id: string;
		type: RoadmapRelationType;
	}) => Promise<void>;
	/** 删除关系；给出时每条关系旁有删除按钮。 */
	onUnrelate?: (relation: RoadmapRelation) => void;
}

/**
 * 条目的详情弹窗：简介、子项清单、关系、标签、交付信息与关联链接，淡入淡出。
 * 有编辑权限时可切换成编辑表单，保存后回到详情。
 */
export function RoadmapItemDialog({
	item,
	items,
	relations,
	open,
	onOpenChange,
	returnFocusTo,
	onSave,
	onDelete,
	onRelate,
	onUnrelate,
}: RoadmapItemDialogProps) {
	const relationsHeadingId = useId();
	const groups = item ? relationGroups(item.id, items, relations) : [];
	// 记的是正在编辑哪个条目：换了条目或关掉弹窗都回到详情
	const [editingId, setEditingId] = useState<string | null>(null);
	const editing = Boolean(onSave) && item !== null && editingId === item.id;
	const described = Boolean(item?.description) && !editing;
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) setEditingId(null);
				onOpenChange(next);
			}}
		>
			<DialogContent
				// 没有简介时没有可关联的描述，显式声明免得 Radix 警告
				{...(described ? {} : { "aria-describedby": undefined })}
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
							{item.blocked && !editing ? (
								<p className="flex items-center gap-1.5 text-sm text-destructive">
									<Lock className="size-3.5 shrink-0" aria-hidden="true" />
									被阻塞：还有未完成的前置条目
								</p>
							) : null}
							{described ? (
								<DialogDescription className="font-reading leading-relaxed whitespace-pre-wrap text-foreground/80">
									{item.description}
								</DialogDescription>
							) : null}
						</DialogHeader>
						{editing && onSave ? (
							<RoadmapItemForm
								key={item.id}
								item={item}
								onSave={async (content) => {
									await onSave(item, content);
									setEditingId(null);
								}}
								onCancel={() => setEditingId(null)}
							/>
						) : null}
						{!editing && item.checklist.length > 0 ? (
							<RoadmapChecklist
								// 换一个条目就重新开始：上一个条目的「隐藏已完成」不该带过来
								key={item.id}
								checklist={item.checklist}
							/>
						) : null}
						{!editing && (groups.length > 0 || onRelate) ? (
							<section aria-labelledby={relationsHeadingId} className="space-y-2">
								<h3
									id={relationsHeadingId}
									className="text-sm text-muted-foreground"
								>
									关系
								</h3>
								{groups.length > 0 ? (
									<dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
										{groups.map((group) => (
											<div key={group.key} className="contents">
												<dt className="whitespace-nowrap text-muted-foreground">
													{group.label}
												</dt>
												<dd>
													<ul className="space-y-1">
														{group.entries.map(
															({ item: other, relation }) => (
																<li
																	key={relation.id}
																	className="flex items-baseline gap-1 font-reading"
																>
																	<span className="min-w-0 flex-1">
																		<span className="mr-1.5 font-mono text-xs text-muted-foreground">
																			#{other.number}
																		</span>
																		{other.title}
																		<span className="ml-2 text-xs text-muted-foreground">
																			{
																				ROADMAP_STAGE_LABELS[
																					other.stage
																				]
																			}
																		</span>
																	</span>
																	{onUnrelate ? (
																		<Button
																			type="button"
																			variant="ghost"
																			size="icon-xs"
																			aria-label={`删除关系：${group.label} #${other.number} ${other.title}`}
																			onClick={() =>
																				onUnrelate(relation)
																			}
																		>
																			<X
																				className="size-3.5"
																				aria-hidden="true"
																			/>
																		</Button>
																	) : null}
																</li>
															),
														)}
													</ul>
												</dd>
											</div>
										))}
									</dl>
								) : null}
								{onRelate ? (
									<RoadmapRelationForm
										item={item}
										items={items}
										onRelate={onRelate}
									/>
								) : null}
							</section>
						) : null}
						{!editing && item.tags.length > 0 ? (
							<ul className="flex flex-wrap gap-1.5" aria-label="条目标签">
								{item.tags.map((tag) => (
									<li key={tag}>
										<Badge variant="secondary">{tag}</Badge>
									</li>
								))}
							</ul>
						) : null}
						{!editing && (item.delivered_version || item.completion_date) ? (
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
						{!editing && item.links.length > 0 ? (
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
						{(onSave || onDelete) && !editing ? (
							<div className="flex justify-end gap-2 border-t border-border/60 pt-4">
								{onDelete ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="text-destructive hover:text-destructive"
										onClick={() => onDelete(item)}
									>
										<Trash2 className="size-4" aria-hidden="true" />
										删除
									</Button>
								) : null}
								{onSave ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setEditingId(item.id)}
									>
										<Pencil className="size-4" aria-hidden="true" />
										编辑
									</Button>
								) : null}
							</div>
						) : null}
					</>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
