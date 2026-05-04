import { useState, useCallback } from "react";
import {
  useEmojisByGroup,
  useCreateEmoji,
  useUpdateEmoji,
  useDeleteEmoji,
} from "@/hooks/useEmojisAdmin";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import EmojiUploader, {
  type EmojiUploadResult,
} from "@/components/admin/EmojiUploader";
import { Images, Upload } from "lucide-react";
import { toast } from "sonner";
import { EmojiToolbar } from "./EmojiToolbar";
import { EmojiList } from "./EmojiList";
import { EmojiEditDialog } from "./EmojiEditDialog";
import type {
  EmojiManageDialogProps,
  EmojiAdmin,
  CreateEmojiInput,
} from "../types";

export function EmojiManageDialog({
  open,
  onOpenChange,
  groupId,
}: EmojiManageDialogProps) {
  const { data: emojis = [] } = useEmojisByGroup(groupId);
  const createEmoji = useCreateEmoji();
  const updateEmoji = useUpdateEmoji();
  const deleteEmoji = useDeleteEmoji();

  const [activeTab, setActiveTab] = useState("manage");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    ids: number[];
  }>({
    open: false,
    ids: [],
  });

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    emoji: EmojiAdmin | null;
  }>({
    open: false,
    emoji: null,
  });
  const [editForm, setEditForm] = useState<CreateEmojiInput>({
    name: "",
    url: "",
    textContent: "",
  });

  const [showAddText, setShowAddText] = useState(false);
  const [textForm, setTextForm] = useState({ name: "", textContent: "" });

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  function handleUpload(result: EmojiUploadResult) {
    const name = result.url.split("/").pop() || `emoji-${Date.now()}`;
    createEmoji.mutate(
      { groupId, data: { name, url: result.url } },
      {
        onSuccess: () => toast.success("表情已添加"),
        onError: () => toast.error("添加失败"),
      }
    );
  }

  function handleAddTextEmoji() {
    if (!textForm.name.trim() || !textForm.textContent.trim()) {
      toast.error("请填写名称和文本内容");
      return;
    }
    createEmoji.mutate(
      {
        groupId,
        data: {
          name: textForm.name.trim(),
          textContent: textForm.textContent.trim(),
        },
      },
      {
        onSuccess: () => {
          toast.success("文本表情已添加");
          setTextForm({ name: "", textContent: "" });
          setShowAddText(false);
        },
        onError: () => toast.error("添加失败"),
      }
    );
  }

  function startEdit(emoji: EmojiAdmin) {
    setEditDialog({ open: true, emoji });
    setEditForm({
      name: emoji.name,
      url: emoji.url || "",
      textContent: emoji.textContent || "",
    });
  }

  function handleSaveEdit() {
    if (!editDialog.emoji) return;
    if (!editForm.name.trim()) {
      toast.error("请填写名称");
      return;
    }
    updateEmoji.mutate(
      { id: editDialog.emoji.id, data: editForm },
      {
        onSuccess: () => {
          toast.success("表情已更新");
          setEditDialog({ open: false, emoji: null });
        },
        onError: () => toast.error("更新失败"),
      }
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
    const ids = deleteConfirm.ids;
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        await deleteEmoji.mutateAsync(id);
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`已删除 ${successCount} 个表情`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} 个表情删除失败`);
    }

    setDeleteConfirm({ open: false, ids: [] });
    setSelectedIds(new Set());
    setIsSelectMode(false);
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = useCallback(() => {
    const start = (currentPage - 1) * 40;
    const pageEmojis = emojis.slice(start, start + 40);
    const pageIds = pageEmojis.map((e) => e.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [emojis, currentPage, selectedIds]);

  const imageCount = emojis.filter((e) => e.url).length;
  const textCount = emojis.filter((e) => !e.url).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Images className="size-5" />
              管理表情
              {emojis.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  共 {emojis.length} 个
                  {imageCount > 0 && ` (图片 ${imageCount}`}
                  {imageCount > 0 && textCount > 0 && ", "}
                  {textCount > 0 && `文本 ${textCount})`}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="shrink-0">
              <TabsTrigger value="manage">
                <Images className="size-4 mr-1" />
                管理
              </TabsTrigger>
              <TabsTrigger value="upload">
                <Upload className="size-4 mr-1" />
                上传
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="manage"
              className="flex-1 overflow-hidden flex flex-col mt-4"
            >
              <EmojiToolbar
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                isSelectMode={isSelectMode}
                onToggleSelectMode={() => {
                  setIsSelectMode(!isSelectMode);
                  if (isSelectMode) {
                    setSelectedIds(new Set());
                  }
                }}
                selectedCount={selectedIds.size}
                onBatchDelete={handleBatchDelete}
                showAddText={showAddText}
                onToggleAddText={() => {
                  setShowAddText(!showAddText);
                  if (showAddText) {
                    setTextForm({ name: "", textContent: "" });
                  }
                }}
                textForm={textForm}
                onTextFormChange={setTextForm}
                onAddTextEmoji={handleAddTextEmoji}
              />

              <div className="flex-1 overflow-y-auto pr-1 -mr-1">
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

            <TabsContent value="upload" className="flex-1 overflow-y-auto mt-4">
              <EmojiUploader onUpload={handleUpload} maxFiles={20} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <EmojiEditDialog
        open={editDialog.open}
        onOpenChange={(open) => setEditDialog({ open, emoji: null })}
        emoji={editDialog.emoji}
        form={editForm}
        onFormChange={setEditForm}
        onSave={handleSaveEdit}
        isSaving={updateEmoji.isPending}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, ids: [] })}
        onConfirm={confirmDelete}
        title="删除表情"
        description={
          deleteConfirm.ids.length > 1
            ? `确定要删除这 ${deleteConfirm.ids.length} 个表情吗？此操作不可撤销。`
            : "确定要删除这个表情吗？此操作不可撤销。"
        }
        confirmLabel="删除"
        destructive
        isLoading={deleteEmoji.isPending}
      />
    </>
  );
}
