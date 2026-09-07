import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { localeLabel } from "@shared/ui/locale-switcher";

interface PersonaEditorDialogsProps {
	deleteOpen: boolean;
	defaultName: string;
	personaId: string;
	deleting: boolean;
	localeToRemove: string;
	onDeleteOpenChange: (open: boolean) => void;
	onConfirmDelete: () => void;
	onLocaleRemoveOpenChange: (open: boolean) => void;
	onConfirmLocaleRemove: () => void;
}

/** 承载会永久删除服务端数据或本地语言草稿的二次确认。 */
export function PersonaEditorDialogs({
	deleteOpen,
	defaultName,
	personaId,
	deleting,
	localeToRemove,
	onDeleteOpenChange,
	onConfirmDelete,
	onLocaleRemoveOpenChange,
	onConfirmLocaleRemove,
}: PersonaEditorDialogsProps) {
	return (
		<>
			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={onDeleteOpenChange}
				onConfirm={onConfirmDelete}
				title="确认删除人设档案"
				description={`确定要永久删除「${defaultName || personaId.slice(0, 8)}」吗？全部语言、资料项和图片引用都会一并清理。`}
				confirmLabel="永久删除"
				loading={deleting}
			/>
			<ConfirmDialog
				open={Boolean(localeToRemove)}
				onOpenChange={onLocaleRemoveOpenChange}
				onConfirm={onConfirmLocaleRemove}
				title="移除语言版本"
				description={`确定移除${localeLabel(localeToRemove)}版本吗？该语言的正文、资料项与图片编排将在下次保存时删除。`}
				confirmLabel="移除版本"
			/>
		</>
	);
}
