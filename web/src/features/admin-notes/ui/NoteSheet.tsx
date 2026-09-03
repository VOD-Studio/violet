import {
	useCreateNote,
	useDeleteNote,
	usePublishNote,
	useSaveNote,
} from "@features/admin-notes/api/mutations";
import { useAdminNote } from "@features/admin-notes/api/queries";
import { NOTE_EDITOR_DISABLED } from "@features/admin-notes/model/editor";
import {
	NOTE_FORM_DEFAULTS,
	type NoteForm,
	noteSchema,
	parseTagsText,
} from "@features/admin-notes/model/schema";
import { NOTE_STATUS_LABELS } from "@features/admin-notes/model/types";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { RichTextEditor } from "@features/editor";
import { useTags } from "@features/tags/api/queries";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@shared/lib/utils";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@shared/ui/base/sheet";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { useNavigate } from "@tanstack/react-router";
import { ExternalLink, Loader2, Maximize2, Plus, Tag as TagIcon, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

interface NoteSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 待编辑笔记 ID；null 或未指定为新建模式 */
	noteId?: string | null;
}

/**
 * 笔记侧滑抽屉：
 * 在列表页直接唤起，支持快速创建与原位编辑。
 * 正文接入项目成熟的 RichTextEditor（Markdown 格式，自带斜杠命令、格式工具栏、公式/图表/代码块直接渲染）。
 * 编辑态右上角支持一键展开跳转至独立全屏工作台。
 */
export function NoteSheet({ open, onOpenChange, noteId }: NoteSheetProps) {
	const navigate = useNavigate();
	const canManage = useHasPermission("note:manage");
	const isEdit = Boolean(noteId);
	const { data: note, isLoading } = useAdminNote(noteId ?? "", isEdit && open);

	const createNote = useCreateNote();
	const saveNote = useSaveNote(noteId ?? "");
	const publishNote = usePublishNote(noteId ?? "");
	const deleteNote = useDeleteNote(noteId ?? "");

	const [deleteOpen, setDeleteOpen] = useState(false);
	const [tagInput, setTagInput] = useState("");

	const {
		register,
		watch,
		reset,
		getValues,
		setValue,
		control,
		formState: { errors, isDirty },
	} = useForm<NoteForm>({
		resolver: zodResolver(noteSchema),
		defaultValues: NOTE_FORM_DEFAULTS,
	});

	// 打开抽屉时初始化表单
	const prevOpen = useRef(false);
	useEffect(() => {
		if (!open) {
			prevOpen.current = false;
			return;
		}
		if (!prevOpen.current) {
			prevOpen.current = true;
			setTagInput("");
			if (!isEdit) {
				reset(NOTE_FORM_DEFAULTS);
			}
		}
	}, [open, isEdit, reset]);

	// 数据加载完成后回填
	useEffect(() => {
		if (open && isEdit && note) {
			reset({
				title: note.title,
				contentMD: note.content_md,
				tagsText: note.tags.join(", "),
			});
		}
	}, [open, isEdit, note, reset]);

	const tagsText = watch("tagsText");
	const currentTags = parseTagsText(tagsText);

	// 推荐常用标签
	const { data: allTags = [] } = useTags();
	const availableTags = useMemo(() => {
		const selected = new Set(currentTags);
		return allTags.filter((t) => !selected.has(t.name)).slice(0, 8);
	}, [allTags, currentTags]);

	const handleAddTag = (raw: string) => {
		const trimmed = raw.trim().replace(/^#/, "");
		if (!trimmed) return;
		if (currentTags.includes(trimmed)) {
			setTagInput("");
			return;
		}
		if (currentTags.length >= 8) return;
		const next = [...currentTags, trimmed];
		setValue("tagsText", next.join(", "), { shouldDirty: true });
		setTagInput("");
	};

	const handleRemoveTag = (target: string) => {
		const next = currentTags.filter((t) => t !== target);
		setValue("tagsText", next.join(", "), { shouldDirty: true });
	};

	const buildRequest = () => {
		const values = getValues();
		return {
			title: values.title.trim(),
			content_md: values.contentMD,
			tags: parseTagsText(values.tagsText),
		};
	};

	const handleSave = async () => {
		const values = getValues();
		const parsed = noteSchema.safeParse(values);
		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message ?? "表单校验失败");
			return;
		}
		try {
			if (!isEdit) {
				await createNote.mutateAsync(buildRequest());
				toast.success("笔记已创建");
				onOpenChange(false);
			} else {
				await saveNote.mutateAsync(buildRequest());
				toast.success("已保存");
				onOpenChange(false);
			}
		} catch (saveError) {
			toast.error(saveError instanceof Error ? saveError.message : "保存失败");
		}
	};

	const handlePublish = async () => {
		if (isDirty) {
			toast.error("有未保存的修改，请先保存再发布");
			return;
		}
		try {
			await publishNote.mutateAsync();
			toast.success("已发布");
			onOpenChange(false);
		} catch (publishError) {
			toast.error(publishError instanceof Error ? publishError.message : "发布失败");
		}
	};

	const handleDelete = async () => {
		try {
			await deleteNote.mutateAsync();
			toast.success("已删除");
			setDeleteOpen(false);
			onOpenChange(false);
		} catch (deleteError) {
			toast.error(deleteError instanceof Error ? deleteError.message : "删除失败");
		}
	};

	const handleOpenFullscreen = () => {
		if (noteId) {
			onOpenChange(false);
			void navigate({ to: "/admin/notes/$id", params: { id: noteId } });
		}
	};

	const saving = createNote.isPending || saveNote.isPending;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="flex h-full w-full flex-col gap-0 overflow-hidden sm:max-w-2xl lg:max-w-3xl"
			>
				{/* 顶栏头部 */}
				<SheetHeader className="border-edge-hairline flex flex-row items-center justify-between border-b px-6 py-4 pr-12">
					<div className="flex items-center gap-3">
						<SheetTitle className="text-lg font-semibold tracking-tight">
							{isEdit ? "编辑笔记" : "新建笔记"}
						</SheetTitle>
						{note ? (
							<Badge variant="outline" className="gap-1.5 py-0.5 text-xs">
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
					</div>
					<SheetDescription className="sr-only">
						{isEdit ? "编辑笔记内容与标签" : "创建一条新的随手笔记"}
					</SheetDescription>

					{/* 扩展操作：全屏跳转 + 前台预览 */}
					<div className="flex items-center gap-1">
						{note?.status === "published" && (
							<Button variant="ghost" size="icon-sm" asChild title="查看前台公开页">
								<a href={`/notes/${note.id}`} target="_blank" rel="noreferrer">
									<ExternalLink className="size-4" />
								</a>
							</Button>
						)}
						{isEdit && (
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={handleOpenFullscreen}
								title="展开为全屏独立工作台"
							>
								<Maximize2 className="size-4" />
							</Button>
						)}
					</div>
				</SheetHeader>

				{/* 中间表单主区 */}
				{isEdit && isLoading ? (
					<div className="flex flex-1 items-center justify-center">
						<Loader2 className="text-muted-foreground size-6 animate-spin" />
					</div>
				) : (
					<div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto px-6 py-5">
						{/* 标题输入 */}
						<div className="space-y-1">
							<Input
								{...register("title")}
								placeholder="无标题笔记（可留空）…"
								aria-label="笔记标题"
								className={cn(
									"h-10 border-none bg-transparent px-0 text-xl font-bold tracking-tight shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0 md:text-2xl",
									errors.title && "text-destructive",
								)}
							/>
							{errors.title ? (
								<p className="text-xs text-destructive">{errors.title.message}</p>
							) : null}
						</div>

						{/* 标签选择与输入区 */}
						<div className="border-edge-hairline bg-muted/20 space-y-2.5 rounded-lg border p-3">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs">
									<TagIcon className="size-3.5" />
									标签 ({currentTags.length}/8)
								</span>
							</div>

							{/* 已选标签 */}
							<div className="flex flex-wrap gap-1.5">
								{currentTags.map((t) => (
									<Badge
										key={t}
										variant="secondary"
										className="gap-1 py-0.5 text-xs font-mono"
									>
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
								{currentTags.length === 0 ? (
									<span className="text-xs text-muted-foreground/60">
										暂未指定标签
									</span>
								) : null}
							</div>

							{/* 标签输入框与推荐 */}
							{currentTags.length < 8 && (
								<div className="space-y-2 pt-1">
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
											placeholder="输入标签名按回车…"
											className="h-7.5 bg-background text-xs"
										/>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => handleAddTag(tagInput)}
											disabled={!tagInput.trim()}
											className="h-7.5 px-2 text-xs"
										>
											<Plus className="mr-1 size-3" /> 添加
										</Button>
									</div>

									{availableTags.length > 0 && (
										<div className="flex flex-wrap items-center gap-1">
											<span className="text-muted-foreground/60 text-[10px] font-mono">
												常用:
											</span>
											{availableTags.map((t) => (
												<button
													key={t.id}
													type="button"
													onClick={() => handleAddTag(t.name)}
													className="text-muted-foreground/70 hover:border-foreground/30 hover:bg-background hover:text-foreground rounded border border-dashed px-1.5 py-0.5 font-mono text-[11px] transition-colors"
												>
													+{t.name}
												</button>
											))}
										</div>
									)}
								</div>
							)}
						</div>

						{/* 正文 Markdown 沉浸式编辑器（RichTextEditor 所见即所得） */}
						<div className="flex min-h-0 flex-1 flex-col space-y-1">
							<Controller
								control={control}
								name="contentMD"
								render={({ field }) => (
									<RichTextEditor
										key={noteId ?? "new"}
										value={field.value}
										onChange={field.onChange}
										contentType="markdown"
										disabledFeatures={NOTE_EDITOR_DISABLED}
										placeholder="开始书写笔记，支持 Markdown、代码块、公式与图表，输入 / 呼出命令菜单…"
										minHeight={340}
										className="flex-1 overflow-hidden rounded-lg shadow-2xs"
									/>
								)}
							/>
							{errors.contentMD ? (
								<p className="mt-1 text-xs text-destructive">
									{errors.contentMD.message}
								</p>
							) : null}
						</div>
					</div>
				)}

				{/* 底部操作条 */}
				<SheetFooter className="border-edge-hairline bg-background/80 flex flex-row items-center justify-between gap-2 border-t px-6 py-3.5 backdrop-blur">
					<div>
						{canManage && isEdit ? (
							<>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="text-destructive hover:bg-destructive/10 hover:text-destructive"
									disabled={deleteNote.isPending || saving}
									onClick={() => setDeleteOpen(true)}
								>
									<Trash2 className="size-4" />
									删除
								</Button>
								<ConfirmDialog
									open={deleteOpen}
									onOpenChange={setDeleteOpen}
									onConfirm={() => void handleDelete()}
									title="删除笔记"
									description="物理删除且不可恢复，确定继续？"
									confirmLabel="删除"
									loading={deleteNote.isPending}
								/>
							</>
						) : null}
					</div>

					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => onOpenChange(false)}
						>
							取消
						</Button>

						{canManage && isEdit && note?.status === "draft" && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={publishNote.isPending || saving}
								onClick={() => void handlePublish()}
							>
								{publishNote.isPending ? (
									<Loader2 className="mr-1.5 size-3.5 animate-spin" />
								) : null}
								发布
							</Button>
						)}

						{canManage && (
							<Button
								type="button"
								size="sm"
								disabled={saving}
								onClick={() => void handleSave()}
							>
								{saving ? (
									<Loader2 className="mr-1.5 size-3.5 animate-spin" />
								) : null}
								{isEdit ? "保存" : "创建"}
							</Button>
						)}
					</div>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
