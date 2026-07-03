import type { Emoji, EmojiUploadResult } from "@entities/emoji/model/types";
import {
    useCreateEmoji,
    useDeleteEmoji,
    useUpdateEmoji,
} from "@features/admin-emojis/api/mutations";
import { useGroupEmojisAdmin } from "@features/admin-emojis/api/queries";
import { ConfirmDialog } from "@features/admin-shared/ui/confirm-dialog";
import { Modal } from "@shared/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/base/tabs";
import { Images, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmojiEditDialog, type EmojiEditForm } from "./EmojiEditDialog";
import { EmojiList } from "./EmojiList";
import { type EmojiTextForm, EmojiToolbar } from "./EmojiToolbar";
import { EmojiUploader } from "./EmojiUploader";

/** 内层弹窗类型：edit/delete 同一时刻仅一个 open */
type InnerDialog = "edit" | "delete" | null;

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
 */
export function EmojiManageDialog({ open, onOpenChange, groupId }: EmojiManageDialogProps) {
    const { data: emojis = [] } = useGroupEmojisAdmin(groupId);
    const createEmoji = useCreateEmoji();
    const updateEmoji = useUpdateEmoji();
    const deleteEmoji = useDeleteEmoji();

    const [activeTab, setActiveTab] = useState("manage");
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [showAddText, setShowAddText] = useState(false);
    const [textForm, setTextForm] = useState<EmojiTextForm>({ name: "", textContent: "" });
    const [deleting, setDeleting] = useState(false);

    const [deleteConfirm, setDeleteConfirm] = useState<number[]>([]);
    const [editEmoji, setEditEmoji] = useState<Emoji | null>(null);
    // 内层弹窗互斥：edit/delete 同一时刻仅一个 open，且 open 期间拦截外层
    // ManageDialog 的关闭（取消编辑不关管理弹窗）
    const [innerDialog, setInnerDialog] = useState<InnerDialog>(null);
    const closeInner = () => setInnerDialog(null);
    const [editForm, setEditForm] = useState<EmojiEditForm>({
        name: "",
        url: "",
        textContent: "",
    });

    // 内层弹窗（编辑/删除确认）打开时，阻止外层被 Radix 嵌套关闭事件连关。
    const handleOpenChange = (o: boolean) => {
        if (!o && innerDialog !== null) return;
        onOpenChange(o);
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
    };

    const handleUpload = (result: EmojiUploadResult) => {
        const name = result.url.split("/").pop() ?? "emoji";
        createEmoji.mutate(
            { groupId, body: { name, url: result.url } },
            {
                onSuccess: () => toast.success("表情已添加"),
                onError: (err) => toast.error(err.message),
            },
        );
    };

    const handleAddTextEmoji = () => {
        if (!textForm.name.trim() || !textForm.textContent.trim()) {
            toast.error("请填写名称和文本内容");
            return;
        }
        createEmoji.mutate(
            {
                groupId,
                body: {
                    name: textForm.name.trim(),
                    text_content: textForm.textContent.trim(),
                },
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
    };

    const startEdit = (emoji: Emoji) => {
        setEditEmoji(emoji);
        setEditForm({
            name: emoji.name,
            url: emoji.url,
            textContent: emoji.text_content ?? "",
        });
        setInnerDialog("edit");
    };

    const handleSaveEdit = () => {
        if (!editEmoji) return;
        if (!editForm.name.trim()) {
            toast.error("请填写名称");
            return;
        }
        updateEmoji.mutate(
            {
                id: editEmoji.id,
                groupId,
                body: {
                    name: editForm.name.trim(),
                    url: editForm.url || undefined,
                    text_content: editForm.textContent || undefined,
                },
            },
            {
                onSuccess: () => {
                    toast.success("表情已更新");
                    closeInner();
                    setEditEmoji(null);
                },
                onError: (err) => toast.error(err.message),
            },
        );
    };

    const handleDelete = (id: number) => {
        setDeleteConfirm([id]);
        setInnerDialog("delete");
    };

    const handleBatchDelete = () => {
        if (selectedIds.size === 0) {
            toast.error("请先选择要删除的表情");
            return;
        }
        setDeleteConfirm(Array.from(selectedIds));
        setInnerDialog("delete");
    };

    const confirmDelete = async () => {
        setDeleting(true);
        let ok = 0;
        let fail = 0;
        for (const id of deleteConfirm) {
            try {
                await deleteEmoji.mutateAsync({ id, groupId });
                ok++;
            } catch {
                fail++;
            }
        }
        if (ok > 0) toast.success(`已删除 ${ok} 个表情`);
        if (fail > 0) toast.error(`${fail} 个表情删除失败`);
        setDeleting(false);
        setDeleteConfirm([]);
        setSelectedIds(new Set());
        setIsSelectMode(false);
        closeInner();
    };

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
            <Modal
                open={open}
                onOpenChange={handleOpenChange}
                size="xl"
                footer={null}
                scrollable={false}
                title={
                    <span className="flex items-center gap-2">
                        <Images className="size-5" />
                        管理表情
                        {emojis.length > 0 && (
                            <span className="text-sm font-normal text-muted-foreground">
                                共 {emojis.length} 个{(imageCount > 0 || textCount > 0) && " ("}
                                {imageCount > 0 && `图片 ${imageCount}`}
                                {imageCount > 0 && textCount > 0 && "，"}
                                {textCount > 0 && `文本 ${textCount}`}
                                {(imageCount > 0 || textCount > 0) && ")"}
                            </span>
                        )}
                    </span>
                }
            >
                <div className="flex h-full flex-col">
                    <Tabs
                        value={activeTab}
                        onValueChange={setActiveTab}
                        className="flex h-full flex-col overflow-hidden"
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

                        <TabsContent
                            value="manage"
                            className="mt-4 flex flex-1 flex-col overflow-hidden"
                        >
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
                </div>
            </Modal>

            <EmojiEditDialog
                open={innerDialog === "edit"}
                onOpenChange={(o) => {
                    if (!o) closeInner();
                }}
                emoji={editEmoji}
                form={editForm}
                onFormChange={setEditForm}
                onSave={handleSaveEdit}
                isSaving={updateEmoji.isPending}
            />

            <ConfirmDialog
                open={innerDialog === "delete"}
                onOpenChange={(o: boolean) => {
                    if (!o) closeInner();
                }}
                title="删除表情"
                description={
                    deleteConfirm.length > 1
                        ? `确定要删除这 ${deleteConfirm.length} 个表情吗？此操作不可撤销。`
                        : "确定要删除这个表情吗？此操作不可撤销。"
                }
                confirmLabel="删除"
                loading={deleting}
                onConfirm={confirmDelete}
            />
        </>
    );
}
