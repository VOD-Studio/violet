import {
	useCreateNote,
	useDeleteNote,
	usePublishNote,
	useSaveNote,
} from "@features/admin-notes/api/mutations";
import { useAdminNote } from "@features/admin-notes/api/queries";
import {
	NOTE_FORM_DEFAULTS,
	type NoteForm,
	noteSchema,
	parseTagsText,
} from "@features/admin-notes/model/schema";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@shared/lib/utils";
import { Input } from "@shared/ui/base/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@shared/ui/base/sheet";
import { MarkdownContent } from "@shared/ui/markdown-preview/MarkdownContent";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { NoteEditorSidebar } from "./NoteEditorSidebar";
import { type EditorViewMode, NoteEditorToolbar } from "./NoteEditorToolbar";

interface NoteEditorProps {
	/** 路由参数；"new" 表示创建模式。 */
	id: string;
}

/**
 * 笔记全屏工作台编辑器：
 * 顶栏工具条 + 左侧沉浸式写作/双栏对照区 + 右侧元信息与标签侧栏。
 */
export function NoteEditor({ id }: NoteEditorProps) {
	const navigate = useNavigate();
	const canManage = useHasPermission("note:manage");
	const isCreate = id === "new";
	const { data: note, isLoading } = useAdminNote(id, !isCreate);

	const createNote = useCreateNote();
	const saveNote = useSaveNote(id);
	const publishNote = usePublishNote(id);
	const deleteNote = useDeleteNote(id);

	const [viewMode, setViewMode] = useState<EditorViewMode>("split");
	const [settingsOpen, setSettingsOpen] = useState(false);

	const {
		register,
		watch,
		reset,
		getValues,
		setValue,
		formState: { errors, isDirty },
	} = useForm<NoteForm>({
		resolver: zodResolver(noteSchema),
		defaultValues: NOTE_FORM_DEFAULTS,
	});

	// API 响应初始化表单
	const initialized = useRef(false);
	useEffect(() => {
		if (isCreate || !note || initialized.current) return;
		initialized.current = true;
		reset({
			title: note.title,
			contentMD: note.content_md,
			tagsText: note.tags.join(", "),
		});
	}, [isCreate, note, reset]);

	const contentMD = watch("contentMD");
	const tagsText = watch("tagsText");
	const currentTags = parseTagsText(tagsText);

	const handleTagsChange = (newTags: string[]) => {
		setValue("tagsText", newTags.join(", "), { shouldDirty: true });
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
			if (isCreate) {
				const created = await createNote.mutateAsync(buildRequest());
				initialized.current = false;
				await navigate({
					to: "/admin/notes/$id",
					params: { id: created.id },
					replace: true,
				});
				toast.success("笔记已创建");
			} else {
				await saveNote.mutateAsync(buildRequest());
				toast.success("已保存");
			}
		} catch (saveError) {
			toast.error(saveError instanceof Error ? saveError.message : "保存失败");
		}
	};

	// ⌘S 快捷键绑定
	const saveRef = useRef(handleSave);
	useEffect(() => {
		saveRef.current = handleSave;
	});
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
				event.preventDefault();
				saveRef.current();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	const handlePublish = async () => {
		if (isDirty) {
			toast.error("有未保存的修改，请先保存再发布");
			return;
		}
		try {
			await publishNote.mutateAsync();
			toast.success("已发布");
		} catch (publishError) {
			toast.error(publishError instanceof Error ? publishError.message : "发布失败");
		}
	};

	const handleDelete = async () => {
		try {
			await deleteNote.mutateAsync();
			toast.success("已删除");
			await navigate({ to: "/admin/notes" });
		} catch (deleteError) {
			toast.error(deleteError instanceof Error ? deleteError.message : "删除失败");
		}
	};

	if (!isCreate && isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="text-muted-foreground size-6 animate-spin" />
			</div>
		);
	}

	const saving = createNote.isPending || saveNote.isPending;

	return (
		<div className="flex h-full flex-col gap-3.5">
			{/* 顶栏工具条 */}
			<NoteEditorToolbar
				isEdit={!isCreate}
				saving={saving}
				isDirty={isDirty}
				canManage={canManage}
				note={note}
				viewMode={viewMode}
				onViewModeChange={setViewMode}
				onBack={() => void navigate({ to: "/admin/notes" })}
				onSave={() => void handleSave()}
				onPublish={() => void handlePublish()}
				onDelete={() => void handleDelete()}
				publishing={publishNote.isPending}
				deleting={deleteNote.isPending}
				onOpenSettings={() => setSettingsOpen(true)}
			/>

			{/* 主编辑工作区与侧栏 */}
			<div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_280px]">
				{/* 左侧创作主区 */}
				<div className="flex min-h-0 min-w-0 flex-col gap-2">
					{/* 无边框大标题输入 */}
					<Input
						{...register("title")}
						placeholder="无标题笔记（可留空）…"
						aria-label="笔记标题"
						className={cn(
							"h-11 border-none bg-transparent px-2 text-2xl font-bold tracking-tight shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0 md:text-3xl",
							errors.title && "text-destructive",
						)}
					/>
					{errors.title ? (
						<p className="px-2 text-xs text-destructive">{errors.title.message}</p>
					) : null}

					{/* 编辑器主卡片容器 */}
					<div className="border-edge-hairline bg-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border shadow-2xs">
						{/* 视图模式 1：左右双栏实时对照 */}
						{viewMode === "split" && (
							<div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-2">
								{/* 左：Markdown 源码 */}
								<div className="flex h-full min-h-0 flex-col">
									<textarea
										{...register("contentMD")}
										placeholder="# 现象&#10;&#10;记录踩坑过程…&#10;&#10;# 根因&#10;&#10;分析问题原因…&#10;&#10;# 修法&#10;&#10;沉淀解决方案…"
										aria-label="正文 markdown"
										spellCheck={false}
										className={cn(
											"size-full resize-none border-0 bg-transparent p-4 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground/40",
											errors.contentMD && "text-destructive",
										)}
									/>
								</div>

								{/* 右：实时预览 */}
								<div className="border-edge-hairline bg-muted/5 flex h-full min-h-0 flex-col overflow-y-auto border-t p-5 md:border-t-0 md:border-l">
									{contentMD.trim() ? (
										<MarkdownContent content={contentMD} />
									) : (
										<p className="text-muted-foreground/40 font-mono text-sm">
											预览区域（左侧输入实时渲染）…
										</p>
									)}
								</div>
							</div>
						)}

						{/* 视图模式 2：纯编辑专注模式 */}
						{viewMode === "edit" && (
							<div className="h-full min-h-0">
								<textarea
									{...register("contentMD")}
									placeholder="# 现象&#10;&#10;记录踩坑过程…"
									aria-label="正文 markdown"
									spellCheck={false}
									className={cn(
										"size-full resize-none border-0 bg-transparent p-5 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground/40",
										errors.contentMD && "text-destructive",
									)}
								/>
							</div>
						)}

						{/* 视图模式 3：纯预览模式 */}
						{viewMode === "preview" && (
							<div className="bg-muted/5 h-full min-h-0 overflow-y-auto p-6">
								{contentMD.trim() ? (
									<MarkdownContent content={contentMD} />
								) : (
									<p className="text-muted-foreground/40 font-mono text-sm">
										正文内容为空
									</p>
								)}
							</div>
						)}
					</div>

					{errors.contentMD ? (
						<p className="px-2 text-xs text-destructive">{errors.contentMD.message}</p>
					) : null}
				</div>

				{/* 桌面端右侧栏 */}
				<div className="hidden overflow-y-auto lg:block">
					<NoteEditorSidebar
						note={note}
						contentLength={contentMD.length}
						tags={currentTags}
						onTagsChange={handleTagsChange}
					/>
				</div>

				{/* 移动端侧滑抽屉 */}
				<Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
					<SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto">
						<SheetHeader className="mb-4">
							<SheetTitle>笔记设置</SheetTitle>
						</SheetHeader>
						<NoteEditorSidebar
							note={note}
							contentLength={contentMD.length}
							tags={currentTags}
							onTagsChange={handleTagsChange}
						/>
					</SheetContent>
				</Sheet>
			</div>
		</div>
	);
}
