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
import type { AdminNote } from "@features/admin-notes/model/types";
import { NOTE_STATUS_LABELS } from "@features/admin-notes/model/types";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@shared/lib/utils";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/base/tabs";
import { Textarea } from "@shared/ui/base/textarea";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { MarkdownContent } from "@shared/ui/markdown-preview/MarkdownContent";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

interface NoteEditorProps {
	/** 路由参数；"new" 表示创建模式。 */
	id: string;
}

/**
 * 笔记编辑器：markdown 源码编辑 + 预览双 Tab。
 *
 * 创建（id=new）先保存落库再进入编辑态；发布只在已保存的草稿上出现。
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

	const {
		register,
		watch,
		reset,
		getValues,
		formState: { errors, isDirty },
	} = useForm<NoteForm>({
		resolver: zodResolver(noteSchema),
		defaultValues: NOTE_FORM_DEFAULTS,
	});

	// API 对象是 snake_case，表单是 camelCase——tags 拆成 tagsText，必须显式映射
	const initialized = useRef(false);
	useEffect(() => {
		if (isCreate || !note || initialized.current) return;
		initialized.current = true;
		reset({
			...NOTE_FORM_DEFAULTS,
			title: note.title,
			contentMD: note.content_md,
			tagsText: note.tags.join(", "),
		});
	}, [isCreate, note, reset]);

	const contentMD = watch("contentMD");

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
			<div className="flex items-center justify-center py-20">
				<Loader2 className="text-muted-foreground size-6 animate-spin" />
			</div>
		);
	}

	const saving = createNote.isPending || saveNote.isPending;

	return (
		<div className="mx-auto max-w-3xl space-y-6">
			<div className="flex items-center justify-between gap-4">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => void navigate({ to: "/admin/notes" })}
				>
					<ArrowLeft className="size-4" />
					返回列表
				</Button>
				{note ? <NoteMeta note={note} /> : null}
			</div>

			<div className="space-y-2">
				<Input
					{...register("title")}
					placeholder="标题（可选）"
					aria-label="笔记标题"
					className={cn(errors.title && "border-destructive")}
				/>
				<Input
					{...register("tagsText")}
					placeholder="标签，逗号分隔（可选，至多 8 个）"
					aria-label="标签"
				/>
			</div>

			<Tabs defaultValue="edit">
				<TabsList>
					<TabsTrigger value="edit">编辑</TabsTrigger>
					<TabsTrigger value="preview">预览</TabsTrigger>
				</TabsList>
				<TabsContent value="edit">
					<Textarea
						{...register("contentMD")}
						placeholder="# 现象&#10;&#10;记录踩坑过程…"
						aria-label="正文 markdown"
						rows={18}
						className={cn(
							"min-h-96 font-mono text-sm",
							errors.contentMD && "border-destructive",
						)}
					/>
					{errors.contentMD ? (
						<p className="text-destructive mt-1.5 text-xs">
							{errors.contentMD.message}
						</p>
					) : null}
				</TabsContent>
				<TabsContent value="preview">
					<div className="border rounded-md p-6">
						{contentMD.trim() ? (
							<MarkdownContent content={contentMD} />
						) : (
							<p className="text-muted-foreground text-sm">正文为空</p>
						)}
					</div>
				</TabsContent>
			</Tabs>

			<div className="flex items-center justify-between border-t pt-4">
				<DeleteButton
					visible={canManage && !isCreate}
					loading={deleteNote.isPending}
					onConfirm={() => void handleDelete()}
				/>
				<div className="flex items-center gap-3">
					{canManage && note?.status === "draft" ? (
						<Button
							variant="outline"
							disabled={publishNote.isPending || saving}
							onClick={() => void handlePublish()}
						>
							{publishNote.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							发布
						</Button>
					) : null}
					{canManage ? (
						<Button disabled={saving} onClick={() => void handleSave()}>
							{saving ? <Loader2 className="size-4 animate-spin" /> : null}
							{isCreate ? "创建" : "保存"}
						</Button>
					) : null}
				</div>
			</div>
		</div>
	);
}

function NoteMeta({ note }: { note: AdminNote }) {
	return (
		<div className="text-muted-foreground flex items-center gap-3 text-xs">
			<Badge variant={note.status === "published" ? "default" : "secondary"}>
				{NOTE_STATUS_LABELS[note.status]}
			</Badge>
			<span>创建 {note.created_at.slice(0, 10)}</span>
			{note.published_at ? <span>发布 {note.published_at.slice(0, 10)}</span> : null}
		</div>
	);
}

function DeleteButton({
	visible,
	loading,
	onConfirm,
}: {
	visible: boolean;
	loading: boolean;
	onConfirm: () => void;
}) {
	const [open, setOpen] = useState(false);
	if (!visible) return null;
	return (
		<>
			<Button
				variant="ghost"
				size="sm"
				className="text-destructive hover:text-destructive"
				disabled={loading}
				onClick={() => setOpen(true)}
			>
				<Trash2 className="size-4" />
				删除
			</Button>
			<ConfirmDialog
				open={open}
				onOpenChange={setOpen}
				onConfirm={onConfirm}
				title="删除笔记"
				description="物理删除且不可恢复，确定继续？"
				confirmLabel="删除"
				loading={loading}
			/>
		</>
	);
}
