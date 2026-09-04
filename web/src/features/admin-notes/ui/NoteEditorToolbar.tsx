import type { AdminNote } from "@features/admin-notes/model/types";
import { NOTE_STATUS_LABELS } from "@features/admin-notes/model/types";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { ArrowLeft, ExternalLink, Loader2, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";

interface NoteEditorToolbarProps {
	isEdit: boolean;
	saving: boolean;
	isDirty: boolean;
	canManage: boolean;
	note?: AdminNote;
	onBack: () => void;
	onSave: () => void;
	onPublish?: () => void;
	onDelete?: () => void;
	publishing?: boolean;
	deleting?: boolean;
	onOpenSettings?: () => void;
}

export function NoteEditorToolbar({
	isEdit,
	saving,
	isDirty,
	canManage,
	note,
	onBack,
	onSave,
	onPublish,
	onDelete,
	publishing = false,
	deleting = false,
	onOpenSettings,
}: NoteEditorToolbarProps) {
	const [deleteOpen, setDeleteOpen] = useState(false);

	return (
		<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
			{/* 左侧：返回 + 标题 + 状态 Badge + 未保存提示 */}
			<div className="flex shrink-0 items-center gap-3">
				<Button variant="ghost" size="icon-sm" onClick={onBack} title="返回列表">
					<ArrowLeft className="size-4" />
				</Button>
				<h1 className="text-lg font-semibold tracking-tight">
					{isEdit ? "编辑笔记" : "新建笔记"}
				</h1>
				{note ? (
					<Badge variant="outline" className="gap-1.5 py-0.5">
						<span
							className={
								note.status === "published"
									? "size-1.5 rounded-full bg-emerald-500"
									: "size-1.5 rounded-full bg-muted-foreground/40"
							}
						/>
						{NOTE_STATUS_LABELS[note.status]}
					</Badge>
				) : null}
				{isDirty && !saving ? (
					<span className="font-mono text-xs text-amber-600 dark:text-amber-400">
						● 未保存
					</span>
				) : null}
			</div>

			{/* 右侧：操作区 */}
			<div className="flex flex-wrap items-center justify-end gap-2">
				{/* 移动端侧边抽屉开关 */}
				{onOpenSettings && (
					<Button
						variant="outline"
						size="sm"
						className="lg:hidden"
						onClick={onOpenSettings}
					>
						<SlidersHorizontal className="mr-1.5 size-3.5" />
						设置
					</Button>
				)}

				{/* 前台直达 */}
				{note?.status === "published" ? (
					<Button variant="ghost" size="sm" asChild>
						<a
							href={`/notes/${note.id}`}
							target="_blank"
							rel="noreferrer"
							title="在新标签页查看公开笔记"
						>
							<ExternalLink className="size-4" />
							前台
						</a>
					</Button>
				) : null}

				{/* 删除按钮 */}
				{canManage && isEdit && onDelete ? (
					<>
						<Button
							variant="ghost"
							size="sm"
							className="text-destructive hover:bg-destructive/10 hover:text-destructive"
							disabled={deleting || saving}
							onClick={() => setDeleteOpen(true)}
						>
							<Trash2 className="size-4" />
							删除
						</Button>
						<ConfirmDialog
							open={deleteOpen}
							onOpenChange={setDeleteOpen}
							onConfirm={() => {
								setDeleteOpen(false);
								onDelete();
							}}
							title="删除笔记"
							description="物理删除且不可恢复，确定继续？"
							confirmLabel="删除"
							loading={deleting}
						/>
					</>
				) : null}

				{/* 发布按钮（草稿时展示） */}
				{canManage && isEdit && note?.status === "draft" && onPublish ? (
					<Button
						variant="outline"
						size="sm"
						disabled={publishing || saving}
						onClick={onPublish}
					>
						{publishing ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
						发布
					</Button>
				) : null}

				{/* 保存/创建按钮 */}
				{canManage ? (
					<Button size="sm" disabled={saving} onClick={onSave}>
						{saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
						{isEdit ? "保存" : "创建"}
					</Button>
				) : null}
			</div>
		</div>
	);
}
