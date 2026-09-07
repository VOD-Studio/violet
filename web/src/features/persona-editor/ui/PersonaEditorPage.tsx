import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { RichTextEditor } from "@features/editor";
import { useActivatePersona, useDeletePersona } from "@features/persona-editor/api/mutations";
import { usePersonaDocument } from "@features/persona-editor/hooks/usePersonaDocument";
import {
	getPersonaCompleteness,
	validatePersonaDocument,
} from "@features/persona-editor/model/document";
import { ApiError } from "@shared/api/error";
import { Button } from "@shared/ui/base/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/base/card";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PersonaEditorToolbar } from "./PersonaEditorToolbar";
import { PersonaFactsSection } from "./PersonaFactsSection";
import { PersonaIdentitySection } from "./PersonaIdentitySection";
import { PersonaImagesSection } from "./PersonaImagesSection";
import { PersonaOperationError } from "./PersonaOperationError";
import { PersonaStatusPanel } from "./PersonaStatusPanel";

interface PersonaEditorPageProps {
	id: string;
}

interface OperationError {
	kind: "validation" | "conflict";
	message: string;
}

/** 人设完整文档编辑、激活、冲突恢复与删除工作台。 */
export function PersonaEditorPage({ id }: PersonaEditorPageProps) {
	const navigate = useNavigate();
	const canManage = useHasPermission("persona:manage");
	const { document, detail, version, isLoading, error, saveState, updateDocument, save, reload } =
		usePersonaDocument({ id, canManage });
	const activate = useActivatePersona(id);
	const remove = useDeletePersona(id);
	const [operationError, setOperationError] = useState<OperationError | null>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);

	const handleSave = async () => {
		if (!document || !canManage) return;
		setOperationError(null);
		const validationError = validatePersonaDocument(document);
		if (validationError) {
			setOperationError({ kind: "validation", message: validationError });
			return;
		}
		const completeness = getPersonaCompleteness(document);
		if (detail?.is_active && completeness.some((item) => !item.complete)) {
			setOperationError({
				kind: "validation",
				message: "当前人设必须保留角色名称、身份简介、设定正文和至少一张设定图。",
			});
			return;
		}
		try {
			await save();
		} catch (saveError) {
			if (saveError instanceof ApiError && saveError.status === 409) {
				setOperationError({
					kind: "conflict",
					message: "服务器上的档案已更新。请重新载入最新版本，再继续编辑。",
				});
				return;
			}
			if (saveError instanceof ApiError && saveError.status === 400) {
				setOperationError({ kind: "validation", message: saveError.message });
				return;
			}
			toast.error(saveError instanceof Error ? saveError.message : "保存失败");
		}
	};
	const saveRef = useRef(handleSave);
	useEffect(() => {
		saveRef.current = handleSave;
	});
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
				event.preventDefault();
				void saveRef.current();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	const reloadLatest = async () => {
		if (await reload()) setOperationError(null);
	};

	const handleActivate = async () => {
		if (!document || !detail || !canManage) return;
		setOperationError(null);
		if (saveState !== "saved") {
			toast.error("有未保存的修改，请先保存再激活");
			return;
		}
		if (getPersonaCompleteness(document).some((item) => !item.complete)) {
			setOperationError({
				kind: "validation",
				message: "激活前需要补全角色名称、身份简介、设定正文和至少一张设定图。",
			});
			return;
		}
		try {
			await activate.mutateAsync({ expected_version: Math.max(version, detail.version) });
			toast.success("已设为当前人设");
		} catch (activateError) {
			if (activateError instanceof ApiError && activateError.status === 409) {
				setOperationError({
					kind: "conflict",
					message: "档案版本已经变化。请重新载入后再激活。",
				});
				return;
			}
			if (activateError instanceof ApiError && activateError.status === 400) {
				setOperationError({ kind: "validation", message: activateError.message });
				return;
			}
			toast.error(activateError instanceof Error ? activateError.message : "激活失败");
		}
	};

	const handleDelete = async () => {
		if (!detail || detail.is_active || !canManage) return;
		setOperationError(null);
		try {
			await remove.mutateAsync({ expected_version: Math.max(version, detail.version) });
			setDeleteOpen(false);
			toast.success("人设档案已删除");
			await navigate({ to: "/admin/personas" });
		} catch (deleteError) {
			setDeleteOpen(false);
			if (deleteError instanceof ApiError && deleteError.status === 409) {
				setOperationError({
					kind: "conflict",
					message: "档案已更新或已成为当前人设。请重新载入后再处理。",
				});
				return;
			}
			toast.error(deleteError instanceof Error ? deleteError.message : "删除失败");
		}
	};

	if (error && !document) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-3">
				<p className="text-sm text-destructive">{error.message}</p>
				<Button variant="outline" onClick={() => void reloadLatest()}>
					<RefreshCw className="size-4" />
					重试
				</Button>
			</div>
		);
	}

	if (isLoading || !document || !detail) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground">
				<Loader2 className="mr-2 size-5 animate-spin" />
				正在载入人设档案
			</div>
		);
	}

	const completeness = getPersonaCompleteness(document);
	const complete = completeness.every((item) => item.complete);
	const pending = activate.isPending || remove.isPending || saveState === "saving";
	const editorDisabled = !canManage || saveState === "conflict" || pending;
	const visibleError =
		saveState === "conflict"
			? {
					kind: "conflict" as const,
					message: "服务器上的档案已更新。请重新载入最新版本，再继续编辑。",
				}
			: operationError;

	return (
		<PageShell
			title="人设档案"
			description={`${document.name || "未命名档案"} · ${detail.is_active ? "当前人设" : "工作稿"}`}
		>
			<PersonaEditorToolbar
				canManage={canManage}
				isActive={detail.is_active}
				isComplete={complete}
				saveState={saveState}
				busy={pending}
				activating={activate.isPending}
				onActivate={() => void handleActivate()}
				onDelete={() => setDeleteOpen(true)}
				onSave={() => void handleSave()}
			/>

			<PersonaOperationError error={visibleError} onReload={() => void reloadLatest()} />

			<div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
				<div className="min-w-0 space-y-6">
					<PersonaIdentitySection
						document={document}
						disabled={editorDisabled}
						onChange={(patch) =>
							updateDocument((current) => ({ ...current, ...patch }))
						}
					/>
					<PersonaFactsSection
						facts={document.facts}
						disabled={editorDisabled}
						onChange={(facts) => updateDocument((current) => ({ ...current, facts }))}
					/>

					<Card>
						<CardHeader>
							<CardTitle>设定正文</CardTitle>
							<p className="text-xs leading-relaxed text-muted-foreground">
								使用 Markdown 编写完整人物设定；编辑器底栏可直接导入 .md 文件。
							</p>
						</CardHeader>
						<CardContent>
							{canManage ? (
								<div
									className={
										editorDisabled
											? "pointer-events-none opacity-70"
											: undefined
									}
								>
									<RichTextEditor
										key={id}
										value={document.content_md}
										onChange={(content_md) =>
											updateDocument((current) => ({
												...current,
												content_md,
											}))
										}
										contentType="markdown"
										placeholder="导入设定文档，或从人物锚点开始书写…"
										exportName={document.name || "persona"}
										minHeight={520}
										autoGrow
									/>
								</div>
							) : detail.content_html ? (
								<ArticleContent
									content={detail.content_html}
									className="prose prose-neutral max-w-none dark:prose-invert"
								/>
							) : (
								<p className="py-8 text-center text-sm text-muted-foreground">
									正文尚未填写
								</p>
							)}
						</CardContent>
					</Card>

					<PersonaImagesSection
						images={document.images}
						disabled={editorDisabled}
						onChange={(images) => updateDocument((current) => ({ ...current, images }))}
					/>
				</div>

				<aside className="min-w-0 xl:sticky xl:top-4">
					<PersonaStatusPanel detail={detail} completeness={completeness} />
				</aside>
			</div>

			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				onConfirm={() => void handleDelete()}
				title="确认删除人设档案"
				description={`确定要永久删除「${document.name || detail.id.slice(0, 8)}」吗？设定正文、资料项和图片引用都会一并清理。`}
				confirmLabel="永久删除"
				loading={remove.isPending}
			/>
		</PageShell>
	);
}
