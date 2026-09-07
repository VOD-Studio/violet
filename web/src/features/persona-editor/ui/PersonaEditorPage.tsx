import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useActivatePersona, useDeletePersona } from "@features/persona-editor/api/mutations";
import { usePersonaDocument } from "@features/persona-editor/hooks/usePersonaDocument";
import { usePersonaSaveShortcut } from "@features/persona-editor/hooks/usePersonaSaveShortcut";
import {
	createPersonaLocalization,
	findPersonaLocalization,
	getPersonaCompleteness,
	updatePersonaLocalization,
	validatePersonaDocument,
} from "@features/persona-editor/model/document";
import { ApiError } from "@shared/api/error";
import { Button } from "@shared/ui/base/button";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { PersonaEditorDialogs } from "./PersonaEditorDialogs";
import { toast } from "sonner";
import { PersonaAvatarField } from "./PersonaAvatarField";
import { PersonaLocalizationEditor } from "./PersonaLocalizationEditor";
import { PersonaEditorToolbar } from "./PersonaEditorToolbar";
import { PersonaLocaleBar } from "./PersonaLocaleBar";
import { PersonaOperationError } from "./PersonaOperationError";
import { PersonaStatusPanel } from "./PersonaStatusPanel";

interface PersonaEditorPageProps {
	id: string;
}

interface OperationError {
	kind: "validation" | "conflict";
	message: string;
}

/** 人设多语言完整文档编辑、激活、冲突恢复与删除工作台。 */
export function PersonaEditorPage({ id }: PersonaEditorPageProps) {
	const navigate = useNavigate();
	const canManage = useHasPermission("persona:manage");
	const { document, detail, version, isLoading, error, saveState, updateDocument, save, reload } =
		usePersonaDocument({ id, canManage });
	const activate = useActivatePersona(id);
	const remove = useDeletePersona(id);
	const [activeLocale, setActiveLocale] = useState("");
	const [operationError, setOperationError] = useState<OperationError | null>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [localeToRemove, setLocaleToRemove] = useState("");

	const editingLocale =
		document && findPersonaLocalization(document, activeLocale)
			? activeLocale
			: (document?.default_locale ?? "");
	const localization = document ? findPersonaLocalization(document, editingLocale) : undefined;
	const defaultLocalization = document
		? findPersonaLocalization(document, document.default_locale)
		: undefined;

	useEffect(() => {
		if (!document) return;
		if (!findPersonaLocalization(document, activeLocale)) {
			setActiveLocale(document.default_locale);
		}
	}, [activeLocale, document]);

	const handleSave = async () => {
		if (!document || !defaultLocalization || !canManage) return;
		setOperationError(null);
		const validationError = validatePersonaDocument(document);
		if (validationError) {
			setOperationError({ kind: "validation", message: validationError });
			return;
		}
		const completeness = getPersonaCompleteness(defaultLocalization, document.avatar);
		if (detail?.is_active && completeness.some((item) => !item.complete)) {
			setOperationError({
				kind: "validation",
				message: "当前人设必须保留角色头像，以及默认语言的名称、简介、正文和设定图。",
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
	usePersonaSaveShortcut(() => void handleSave());

	const reloadLatest = async () => {
		if (await reload()) setOperationError(null);
	};

	const handleActivate = async () => {
		if (!document || !detail || !defaultLocalization || !canManage) return;
		setOperationError(null);
		if (saveState !== "saved") {
			toast.error("有未保存的修改，请先保存再激活");
			return;
		}
		if (
			getPersonaCompleteness(defaultLocalization, document.avatar).some(
				(item) => !item.complete,
			)
		) {
			setOperationError({
				kind: "validation",
				message: "激活前需要配置角色头像，并补全默认语言的名称、简介、正文和设定图。",
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

	if (isLoading || !document || !detail || !localization || !defaultLocalization) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground">
				<Loader2 className="mr-2 size-5 animate-spin" />
				正在载入人设档案
			</div>
		);
	}

	const defaultCompleteness = getPersonaCompleteness(defaultLocalization, document.avatar);
	const defaultComplete = defaultCompleteness.every((item) => item.complete);
	const localeComplete = getPersonaCompleteness(localization, document.avatar).every(
		(item) => item.complete,
	);
	const pending = activate.isPending || remove.isPending || saveState === "saving";
	const editorDisabled = !canManage || saveState === "conflict" || pending;
	const visibleError =
		saveState === "conflict"
			? {
					kind: "conflict" as const,
					message: "服务器上的档案已更新。请重新载入最新版本，再继续编辑。",
				}
			: operationError;
	const defaultName = defaultLocalization.name || "未命名档案";

	const updateLocalization = (updater: Parameters<typeof updatePersonaLocalization>[2]) => {
		updateDocument((current) => updatePersonaLocalization(current, editingLocale, updater));
	};

	return (
		<PageShell
			title="人设档案"
			description={`${defaultName} · ${detail.is_active ? "当前人设" : "工作稿"}`}
			action={
				<PersonaEditorToolbar
					canManage={canManage}
					isActive={detail.is_active}
					isComplete={defaultComplete}
					saveState={saveState}
					busy={pending}
					activating={activate.isPending}
					onActivate={() => void handleActivate()}
					onDelete={() => setDeleteOpen(true)}
					onSave={() => void handleSave()}
				/>
			}
		>
			<PersonaOperationError error={visibleError} onReload={() => void reloadLatest()} />

			<PersonaLocaleBar
				locales={document.localizations.map(({ locale }) => locale)}
				value={editingLocale}
				defaultLocale={document.default_locale}
				complete={localeComplete}
				disabled={editorDisabled}
				onValueChange={setActiveLocale}
				onAdd={(locale) => {
					updateDocument((current) => ({
						...current,
						localizations: [
							...current.localizations,
							createPersonaLocalization(locale),
						],
					}));
					setActiveLocale(locale);
				}}
				onSetDefault={(locale) =>
					updateDocument((current) => ({ ...current, default_locale: locale }))
				}
				onRemove={setLocaleToRemove}
			/>

			<div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
				<div className="min-w-0 space-y-6">
					<PersonaAvatarField
						avatar={document.avatar}
						disabled={editorDisabled}
						onChange={(avatar) => updateDocument((current) => ({ ...current, avatar }))}
					/>
					<PersonaLocalizationEditor
						personaId={id}
						localization={localization}
						canManage={canManage}
						disabled={editorDisabled}
						onChange={updateLocalization}
					/>
				</div>

				<aside className="min-w-0 xl:sticky xl:top-4">
					<PersonaStatusPanel detail={detail} completeness={defaultCompleteness} />
				</aside>
			</div>

			<PersonaEditorDialogs
				deleteOpen={deleteOpen}
				defaultName={defaultName}
				personaId={detail.id}
				deleting={remove.isPending}
				localeToRemove={localeToRemove}
				onDeleteOpenChange={setDeleteOpen}
				onConfirmDelete={() => void handleDelete()}
				onLocaleRemoveOpenChange={(open) => {
					if (!open) setLocaleToRemove("");
				}}
				onConfirmLocaleRemove={() => {
					if (!localeToRemove) return;
					updateDocument((current) => ({
						...current,
						localizations: current.localizations.filter(
							(candidate) => candidate.locale !== localeToRemove,
						),
					}));
					setActiveLocale(document.default_locale);
					setLocaleToRemove("");
				}}
			/>
		</PageShell>
	);
}
