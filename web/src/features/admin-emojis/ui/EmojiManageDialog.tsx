import { ConfirmDialog } from "@features/admin-shared/ui/ConfirmDialog";
import { emojiKeys } from "@features/emojis/api/keys";
import { useCreateEmoji, useUpdateEmoji } from "@features/emojis/api/mutations";
import { useGroupEmojisAdmin } from "@features/emojis/api/queries";
import type { Emoji, EmojiUploadResult } from "@features/emojis/model/types";
import { apiDelete } from "@shared/api/request";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@shared/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { Images, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmojiEditDialog, type EmojiEditForm } from "./EmojiEditDialog";
import { EmojiList } from "./EmojiList";
import { type EmojiTextForm, EmojiToolbar } from "./EmojiToolbar";
import { EmojiUploader } from "./EmojiUploader";

interface EmojiManageDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	groupId: number;
}

/**
 * EmojiManageDialog - 管理分组内表情
 *
 * Tabs 切换管理与上传。管理侧含搜索、批量选择删除、添加文本表情、
 * 单条编辑删除；上传侧批量上传图片并立即落库。
 * 删除走 apiDelete 逐条调用并失效缓存，以支持批量 id 场景。
 */
export function EmojiManageDialog({ open, onOpenChange, groupId }: EmojiManageDialogProps) {
	const qc = useQueryClient();
	const { data: emojis = [] } = useGroupEmojisAdmin(groupId);
	const createEmoji = useCreateEmoji(groupId);

	const [activeTab, setActiveTab] = useState("manage");
	const [searchQuery, setSearchQuery] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
	const [isSelectMode, setIsSelectMode] = useState(false);
	const [showAddText, setShowAddText] = useState(false);
	const [textForm, setTextForm] = useState<EmojiTextForm>({ name: "", textContent: "" });
	const [deleting, setDeleting] = useState(false);

	const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; ids: number[] }>({
		open: false,
		ids: [],
	});
	const [editDialog, setEditDialog] = useState<{ open: boolean; emoji: Emoji | null }>({
		open: false,
		emoji: null,
	});
	const [editForm, setEditForm] = useState<EmojiEditForm>({
		name: "",
		url: "",
		textContent: "",
	});

	const updateEmoji = useUpdateEmoji(editDialog.emoji?.id ?? 0, groupId);

	const handleSearchChange = (value: string) => {
		setSearchQuery(value);
		setCurrentPage(1);
	};

	function handleUpload(result: EmojiUploadResult) {
		const name = result.url.split("/").pop() ?? "emoji";
		createEmoji.mutate(
			{ name, url: result.url },
			{
				onSuccess: () => toast.success("表情已添加"),
				onError: (err) => toast.error(err.message),
			},
		);
	}

	function handleAddTextEmoji() {
		if (!textForm.name.trim() || !textForm.textContent.trim()) {
			toast.error("请填写名称和文本内容");
			return;
		}
		createEmoji.mutate(
			{
				name: textForm.name.trim(),
				text_content: textForm.textContent.trim(),
			},
			{
				onSuccess: () => {
					toast.success("文本表情已添加");
					setTextForm({ name: "", textContent: "" });
					setShowAddText(false);
				},
				onError: (err) => toast.error(err.message),
			},
		);
	}

	function startEdit(emoji: Emoji) {
		setEditDialog({ open: true, emoji });
		setEditForm({
			name: emoji.name,
			url: emoji.url,
			textContent: emoji.text_content ?? "",
		});
	}

	function handleSaveEdit() {
		if (!editDialog.emoji) return;
		if (!editForm.name.trim()) {
			toast.error("请填写名称");
			return;
		}
		updateEmoji.mutate(
			{
				name: editForm.name.trim(),
				url: editForm.url || undefined,
				text_content: editForm.textContent || undefined,
			},
			{
				onSuccess: () => {
					toast.success("表情已更新");
					setEditDialog({ open: false, emoji: null });
				},
				onError: (err) => toast.error(err.message),
			},
		);
	}

	function handleDelete(id: number) {
		setDeleteConfirm({ open: true, ids: [id] });
	}

	function handleBatchDelete() {
		if (selectedIds.size === 0) {
			toast.error("请先选择要删除的表情");
			return;
		}
		setDeleteConfirm({ open: true, ids: Array.from(selectedIds) });
	}

	async function confirmDelete() {
		setDeleting(true);
		let ok = 0;
		let fail = 0;
		for (const id of deleteConfirm.ids) {
			try {
				await apiDelete<null>(`/admin/emojis/emojis/${id}`);
				ok++;
			} catch {
				fail++;
			}
		}
		if (ok > 0) toast.success(`已删除 ${ok} 个表情`);
		if (fail > 0) toast.error(`${fail} 个表情删除失败`);
		setDeleting(false);
		setDeleteConfirm({ open: false, ids: [] });
		setSelectedIds(new Set());
		setIsSelectMode(false);
		qc.invalidateQueries({ queryKey: emojiKeys.adminGroupEmojis(groupId) });
		qc.invalidateQueries({ queryKey: emojiKeys.publicGroupList() });
	}

	const toggleSelect = (id: number) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const toggleSelectAll = () => {
		const start = (currentPage - 1) * 40;
		const pageIds = emojis.slice(start, start + 40).map((e) => e.id);
		const allSelected = pageIds.every((id) => selectedIds.has(id));
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (allSelected) {
				pageIds.forEach((id) => {
					next.delete(id);
				});
			} else {
				pageIds.forEach((id) => {
					next.add(id);
				});
			}
			return next;
		});
	};

	const imageCount = emojis.filter((e) => e.url).length;
	const textCount = emojis.length - imageCount;

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="flex max-h-[85vh] max-w-xl flex-col sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Images className="size-5" />
							管理表情
							{emojis.length > 0 && (
								<span className="text-sm font-normal text-muted-foreground">
									共 {emojis.length} 个{imageCount > 0 && ` (图片 ${imageCount}`}
									{imageCount > 0 && textCount > 0 && ", "}
									{textCount > 0 && `文本 ${textCount})`}
								</span>
							)}
						</DialogTitle>
					</DialogHeader>

					<Tabs
						value={activeTab}
						onValueChange={setActiveTab}
						className="flex flex-1 flex-col overflow-hidden"
					>
						<TabsList className="shrink-0">
							<TabsTrigger value="manage">
								<Images className="mr-1 size-4" />
								管理
							</TabsTrigger>
							<TabsTrigger value="upload">
								<Upload className="mr-1 size-4" />
								上传
							</TabsTrigger>
						</TabsList>

						<TabsContent value="manage" className="mt-4 flex flex-1 flex-col overflow-hidden">
							<EmojiToolbar
								searchQuery={searchQuery}
								onSearchChange={handleSearchChange}
								isSelectMode={isSelectMode}
								onToggleSelectMode={() => {
									setIsSelectMode(!isSelectMode);
									if (isSelectMode) setSelectedIds(new Set());
								}}
								selectedCount={selectedIds.size}
								onBatchDelete={handleBatchDelete}
								showAddText={showAddText}
								onToggleAddText={() => {
									setShowAddText(!showAddText);
									if (showAddText) setTextForm({ name: "", textContent: "" });
								}}
								textForm={textForm}
								onTextFormChange={setTextForm}
								onAddTextEmoji={handleAddTextEmoji}
							/>

							<div className="-mr-1 flex-1 overflow-y-auto pr-1">
								<EmojiList
									emojis={emojis}
									searchQuery={searchQuery}
									currentPage={currentPage}
									onPageChange={setCurrentPage}
									isSelectMode={isSelectMode}
									selectedIds={selectedIds}
									onToggleSelect={toggleSelect}
									onToggleSelectAll={toggleSelectAll}
									onEdit={startEdit}
									onDelete={handleDelete}
								/>
							</div>
						</TabsContent>

						<TabsContent value="upload" className="mt-4 flex-1 overflow-y-auto">
							<EmojiUploader onUpload={handleUpload} maxFiles={20} />
						</TabsContent>
					</Tabs>
				</DialogContent>
			</Dialog>

			<EmojiEditDialog
				open={editDialog.open}
				onOpenChange={(o) => setEditDialog({ open: o, emoji: null })}
				emoji={editDialog.emoji}
				form={editForm}
				onFormChange={setEditForm}
				onSave={handleSaveEdit}
				isSaving={updateEmoji.isPending}
			/>

			<ConfirmDialog
				open={deleteConfirm.open}
				onOpenChange={(o: boolean) => setDeleteConfirm({ open: o, ids: [] })}
				title="删除表情"
				description={
					deleteConfirm.ids.length > 1
						? `确定要删除这 ${deleteConfirm.ids.length} 个表情吗？此操作不可撤销。`
						: "确定要删除这个表情吗？此操作不可撤销。"
				}
				confirmLabel="删除"
				loading={deleting}
				onConfirm={confirmDelete}
			/>
		</>
	);
}
