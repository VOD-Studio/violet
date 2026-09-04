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
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { RichTextEditor } from "@features/editor";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@shared/lib/utils";
import { Input } from "@shared/ui/base/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@shared/ui/base/sheet";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { NoteEditorSidebar } from "./NoteEditorSidebar";
import { NoteEditorToolbar } from "./NoteEditorToolbar";

interface NoteEditorProps {
	/** 路由参数；"new" 表示创建模式。 */
	id: string;
}

/**
 * 笔记全屏工作台编辑器：
 * 顶栏工具条 + 左侧沉浸式所见即所得写作区（基于 RichTextEditor，Markdown 原生支持）+ 右侧元信息与标签侧栏。
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

	const [settingsOpen, setSettingsOpen] = useState(false);

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

					{/* 编辑器主卡片容器：RichTextEditor 所见即所得 Markdown */}
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg shadow-2xs">
						<Controller
							control={control}
							name="contentMD"
							render={({ field }) => (
								<RichTextEditor
									key={id}
									value={field.value}
									onChange={field.onChange}
									contentType="markdown"
									disabledFeatures={NOTE_EDITOR_DISABLED}
									placeholder="开始书写笔记，支持 Markdown、代码块、公式与图表，输入 / 呼出命令菜单…"
									className="h-full"
									minHeight={400}
								/>
							)}
						/>
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
