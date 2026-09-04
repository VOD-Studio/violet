import type { AdminNote } from "@features/admin-notes/model/types";
import { useTags } from "@features/tags/api/queries";
import { Badge } from "@shared/ui/base/badge";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { Clock, FileText, Hash, Info, Plus, Tag as TagIcon, X } from "lucide-react";
import { useMemo, useState } from "react";

interface NoteEditorSidebarProps {
	note?: AdminNote;
	contentLength: number;
	tags: string[];
	onTagsChange: (tags: string[]) => void;
}

export function NoteEditorSidebar({
	note,
	contentLength,
	tags,
	onTagsChange,
}: NoteEditorSidebarProps) {
	const { data: allTags = [] } = useTags();
	const [tagInput, setTagInput] = useState("");

	// 推荐候选标签（系统中存在但当前未选中的标签）
	const availableTags = useMemo(() => {
		const selected = new Set(tags);
		return allTags.filter((t) => !selected.has(t.name)).slice(0, 12);
	}, [allTags, tags]);

	const handleAddTag = (raw: string) => {
		const trimmed = raw.trim().replace(/^#/, "");
		if (!trimmed) return;
		if (tags.includes(trimmed)) {
			setTagInput("");
			return;
		}
		if (tags.length >= 8) return;
		onTagsChange([...tags, trimmed]);
		setTagInput("");
	};

	const handleRemoveTag = (target: string) => {
		onTagsChange(tags.filter((t) => t !== target));
	};

	const readingMinutes = Math.max(1, Math.ceil(contentLength / 400));

	return (
		<aside className="flex flex-col gap-4">
			{/* 标签管理卡片 */}
			<div className="border-edge-hairline bg-background rounded-lg border p-4 shadow-2xs">
				<div className="mb-3 flex items-center justify-between">
					<Label className="flex items-center gap-1.5 font-medium">
						<TagIcon className="text-muted-foreground size-3.5" />
						标签
					</Label>
					<span className="font-mono text-xs text-muted-foreground">{tags.length}/8</span>
				</div>

				{/* 已选标签 */}
				<div className="mb-3 flex flex-wrap gap-1.5">
					{tags.map((t) => (
						<Badge key={t} variant="secondary" className="gap-1 py-0.5 text-xs">
							#{t}
							<button
								type="button"
								onClick={() => handleRemoveTag(t)}
								className="hover:text-destructive transition-colors"
								aria-label={`移除标签 ${t}`}
							>
								<X className="size-3" />
							</button>
						</Badge>
					))}
					{tags.length === 0 ? (
						<span className="text-xs text-muted-foreground/70">暂无标签</span>
					) : null}
				</div>

				{/* 标签输入 */}
				{tags.length < 8 ? (
					<div className="flex items-center gap-1.5">
						<Input
							value={tagInput}
							onChange={(e) => setTagInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === ",") {
									e.preventDefault();
									handleAddTag(tagInput);
								}
							}}
							placeholder="输入标签按回车…"
							className="h-8 text-xs"
						/>
						<button
							type="button"
							onClick={() => handleAddTag(tagInput)}
							disabled={!tagInput.trim()}
							className="border-input hover:bg-muted disabled:opacity-40 inline-flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors"
							aria-label="添加标签"
						>
							<Plus className="size-3.5" />
						</button>
					</div>
				) : null}

				{/* 系统推荐标签 */}
				{availableTags.length > 0 && tags.length < 8 ? (
					<div className="border-edge-hairline mt-3 border-t pt-3">
						<p className="text-muted-foreground/70 mb-2 font-mono text-[10px] tracking-wider uppercase">
							常用标签
						</p>
						<div className="flex flex-wrap gap-1">
							{availableTags.map((t) => (
								<button
									key={t.id}
									type="button"
									onClick={() => handleAddTag(t.name)}
									className="text-muted-foreground/80 hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground rounded border border-dashed px-1.5 py-0.5 font-mono text-[11px] transition-colors"
								>
									+{t.name}
								</button>
							))}
						</div>
					</div>
				) : null}
			</div>

			{/* 元信息卡片 */}
			<div className="border-edge-hairline bg-background rounded-lg border p-4 shadow-2xs">
				<Label className="mb-3 flex items-center gap-1.5 font-medium">
					<Info className="text-muted-foreground size-3.5" />
					文档指标
				</Label>
				<div className="space-y-2.5 text-xs">
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground flex items-center gap-1.5">
							<FileText className="size-3 text-muted-foreground/70" />
							字数
						</span>
						<span className="font-mono font-medium">{contentLength} 字</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground flex items-center gap-1.5">
							<Clock className="size-3 text-muted-foreground/70" />
							预估阅读
						</span>
						<span className="font-mono font-medium">约 {readingMinutes} 分钟</span>
					</div>
					{note ? (
						<>
							<div className="border-edge-hairline border-t pt-2" />
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">创建时间</span>
								<span className="font-mono text-muted-foreground/80">
									{note.created_at.slice(0, 10)}
								</span>
							</div>
							{note.published_at ? (
								<div className="flex items-center justify-between">
									<span className="text-muted-foreground">发布时间</span>
									<span className="font-mono text-muted-foreground/80">
										{note.published_at.slice(0, 10)}
									</span>
								</div>
							) : null}
						</>
					) : null}
				</div>
			</div>

			{/* 快捷键提示 */}
			<div className="border-edge-hairline bg-muted/20 text-muted-foreground/80 rounded-lg border p-3.5 text-xs">
				<p className="mb-1.5 flex items-center gap-1.5 font-medium text-foreground">
					<Hash className="size-3.5 text-muted-foreground" />
					写作贴士
				</p>
				<ul className="space-y-1 text-[11px] leading-relaxed">
					<li>
						• 按 <kbd className="bg-muted rounded px-1 font-mono">⌘ S</kbd>{" "}
						随时快捷保存。
					</li>
					<li>• 标题留空时，系统自动提取首行作为索引摘要。</li>
					<li>• 正文推荐使用「现象 / 根因 / 修法」三段式排版。</li>
				</ul>
			</div>
		</aside>
	);
}
