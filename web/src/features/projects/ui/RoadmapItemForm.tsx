import { Button, Checkbox, Input, Label, Textarea } from "@violet/ui";
import { Plus, X } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import {
	contentFromDraft,
	draftOf,
	type RoadmapContentInput,
	type RoadmapDraft,
} from "../lib/roadmap-content";
import type { RoadmapItem } from "../model/roadmap";

export interface RoadmapItemFormProps {
	item: RoadmapItem;
	/** 保存整理好的内容；失败时抛出，表单留着草稿并显示原因。 */
	onSave: (content: RoadmapContentInput) => Promise<void>;
	onCancel: () => void;
}

const SECTION = "space-y-2";
const LEGEND = "text-sm font-medium";

/**
 * 条目内容的编辑表单：标题、简介、标签、关联链接与子项清单；已完成条目另有交付版本与完成日期。
 * 阶段与顺序不在这里改，靠看板上的移动。
 */
export function RoadmapItemForm({ item, onSave, onCancel }: RoadmapItemFormProps) {
	const [draft, setDraft] = useState<RoadmapDraft>(() => draftOf(item));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [titleMissing, setTitleMissing] = useState(false);
	const descriptionId = useId();
	const completed = item.stage === "completed";

	const patch = (next: Partial<RoadmapDraft>) => setDraft((current) => ({ ...current, ...next }));
	const setLink = (index: number, next: Partial<RoadmapDraft["links"][number]>) =>
		patch({
			links: draft.links.map((link, at) => (at === index ? { ...link, ...next } : link)),
		});
	const setStep = (index: number, next: Partial<RoadmapDraft["checklist"][number]>) =>
		patch({
			checklist: draft.checklist.map((entry, at) =>
				at === index ? { ...entry, ...next } : entry,
			),
		});

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const content = contentFromDraft(draft, item);
		if (!content.title) {
			setTitleMissing(true);
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await onSave(content);
		} catch (cause) {
			setError(cause instanceof Error && cause.message ? cause.message : "未能保存，请重试");
			setSaving(false);
		}
	};

	return (
		<form onSubmit={submit} className="space-y-5" aria-label={`编辑 #${item.number}`}>
			<Input
				label="标题"
				value={draft.title}
				maxLength={200}
				invalid={titleMissing}
				errorMessage="标题不能为空"
				onChange={(event) => {
					patch({ title: event.target.value });
					setTitleMissing(false);
				}}
			/>
			<div className={SECTION}>
				<Label htmlFor={descriptionId}>简介</Label>
				<Textarea
					id={descriptionId}
					rows={4}
					value={draft.description}
					onChange={(event) => patch({ description: event.target.value })}
				/>
			</div>
			<Input
				label="标签"
				description="用逗号分隔"
				value={draft.tags}
				onChange={(event) => patch({ tags: event.target.value })}
			/>

			<fieldset className={SECTION}>
				<legend className={LEGEND}>关联链接</legend>
				{draft.links.map((link, index) => (
					// 链接没有稳定标识，按位置编辑
					<div key={index} className="flex items-center gap-2">
						<Input
							aria-label={`链接 ${index + 1} 的名称`}
							placeholder="名称（可选）"
							value={link.label}
							classNames={{ root: "w-36 shrink-0" }}
							onChange={(event) => setLink(index, { label: event.target.value })}
						/>
						<Input
							aria-label={`链接 ${index + 1} 的地址`}
							placeholder="https:// 或 /站内路径"
							value={link.url}
							classNames={{ root: "min-w-0 flex-1" }}
							onChange={(event) => setLink(index, { url: event.target.value })}
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label={`删除链接 ${index + 1}`}
							onClick={() =>
								patch({ links: draft.links.filter((_, at) => at !== index) })
							}
						>
							<X className="size-4" aria-hidden="true" />
						</Button>
					</div>
				))}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => patch({ links: [...draft.links, { label: "", url: "" }] })}
				>
					<Plus className="size-4" aria-hidden="true" />
					添加链接
				</Button>
			</fieldset>

			<fieldset className={SECTION}>
				<legend className={LEGEND}>子项</legend>
				{draft.checklist.map((entry, index) => (
					// 子项没有稳定标识，清单整体替换，按位置编辑
					<div key={index} className="flex items-center gap-2">
						<Checkbox
							aria-label={`子项 ${index + 1} 已完成`}
							checked={entry.done}
							onCheckedChange={(checked) =>
								setStep(index, { done: checked === true })
							}
						/>
						<Input
							aria-label={`子项 ${index + 1}`}
							value={entry.text}
							maxLength={500}
							classNames={{ root: "min-w-0 flex-1" }}
							onChange={(event) => setStep(index, { text: event.target.value })}
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label={`删除子项 ${index + 1}`}
							onClick={() =>
								patch({
									checklist: draft.checklist.filter((_, at) => at !== index),
								})
							}
						>
							<X className="size-4" aria-hidden="true" />
						</Button>
					</div>
				))}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() =>
						patch({ checklist: [...draft.checklist, { text: "", done: false }] })
					}
				>
					<Plus className="size-4" aria-hidden="true" />
					添加子项
				</Button>
			</fieldset>

			{completed ? (
				<div className="grid gap-4 sm:grid-cols-2">
					<Input
						label="交付版本"
						value={draft.deliveredVersion}
						onChange={(event) => patch({ deliveredVersion: event.target.value })}
					/>
					<Input
						label="完成日期"
						type="date"
						value={draft.completionDate}
						onChange={(event) => patch({ completionDate: event.target.value })}
					/>
				</div>
			) : null}

			{error ? (
				<p role="alert" className="text-sm text-destructive-text">
					{error}
				</p>
			) : null}
			<div className="flex justify-end gap-2">
				<Button type="button" variant="ghost" onClick={onCancel}>
					取消
				</Button>
				<Button type="submit" disabled={saving}>
					{saving ? "保存中…" : "保存"}
				</Button>
			</div>
		</form>
	);
}
