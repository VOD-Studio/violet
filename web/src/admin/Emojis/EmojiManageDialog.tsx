import { useState, useMemo, useCallback } from "react";
import {
  useEmojisByGroup,
  useCreateEmoji,
  useUpdateEmoji,
  useDeleteEmoji,
  getEmojiDisplay,
} from "@/hooks/useEmojisAdmin";
import type { EmojiAdmin, CreateEmojiInput } from "@/hooks/useEmojisAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Pagination } from "@/components/shared/Pagination";
import EmojiUploader, { type EmojiUploadResult } from "@/components/admin/EmojiUploader";
import {
  Trash2,
  Edit,
  Link,
  Type,
  Check,
  X,
  Search,
  Plus,
  CheckSquare,
  Square,
  Loader2,
  Images,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

/** 每页显示的表情数量 */
const PAGE_SIZE = 40;

interface EmojiManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
}

export function EmojiManageDialog({
  open,
  onOpenChange,
  groupId,
}: EmojiManageDialogProps) {
  const { data: emojis = [] } = useEmojisByGroup(groupId);
  const createEmoji = useCreateEmoji();
  const updateEmoji = useUpdateEmoji();
  const deleteEmoji = useDeleteEmoji();

  // 状态管理
  const [activeTab, setActiveTab] = useState("manage");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // 删除确认弹窗
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    ids: number[];
  }>({
    open: false,
    ids: [],
  });

  // 编辑弹窗
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

  // 添加文本表情弹窗
  const [showAddText, setShowAddText] = useState(false);
  const [textForm, setTextForm] = useState({ name: "", textContent: "" });

  // 搜索过滤
  const filteredEmojis = useMemo(() => {
    if (!searchQuery.trim()) return emojis;
    const query = searchQuery.toLowerCase();
    return emojis.filter(
      (emoji) =>
        emoji.name.toLowerCase().includes(query) ||
        emoji.textContent?.toLowerCase().includes(query)
    );
  }, [emojis, searchQuery]);

  // 分页计算
  const totalPages = Math.ceil(filteredEmojis.length / PAGE_SIZE);
  const paginatedEmojis = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEmojis.slice(start, start + PAGE_SIZE);
  }, [filteredEmojis, currentPage]);

  // 重置分页和选择
  const resetPagination = useCallback(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
    setIsSelectMode(false);
  }, []);

  // 搜索变化时重置分页
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // 上传处理
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

  // 添加文本表情
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

  // 开始编辑
  function startEdit(emoji: EmojiAdmin) {
    setEditDialog({ open: true, emoji });
    setEditForm({
      name: emoji.name,
      url: emoji.url || "",
      textContent: emoji.textContent || "",
    });
  }

  // 保存编辑
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

  // 删除单个
  function handleDelete(id: number) {
    setDeleteConfirm({ open: true, ids: [id] });
  }

  // 批量删除
  function handleBatchDelete() {
    if (selectedIds.size === 0) {
      toast.error("请先选择要删除的表情");
      return;
    }
    setDeleteConfirm({ open: true, ids: Array.from(selectedIds) });
  }

  // 确认删除
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

  // 选择切换
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

  // 全选/取消全选当前页
  const toggleSelectAll = () => {
    const pageIds = paginatedEmojis.map((e) => e.id);
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
  };

  // 表情类型统计
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

            {/* 管理标签页 */}
            <TabsContent value="manage" className="flex-1 overflow-hidden flex flex-col mt-4">
              {/* 工具栏 */}
              <div className="flex items-center gap-2 shrink-0 mb-4">
                {/* 搜索框 */}
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索表情名称..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* 选择模式按钮 */}
                <Button
                  variant={isSelectMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsSelectMode(!isSelectMode);
                    if (isSelectMode) {
                      setSelectedIds(new Set());
                    }
                  }}
                >
                  {isSelectMode ? (
                    <>
                      <CheckSquare className="mr-1 size-4" />
                      取消选择
                    </>
                  ) : (
                    <>
                      <Square className="mr-1 size-4" />
                      批量选择
                    </>
                  )}
                </Button>

                {/* 批量删除按钮 */}
                {isSelectMode && selectedIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBatchDelete}
                  >
                    <Trash2 className="mr-1 size-4" />
                    删除 ({selectedIds.size})
                  </Button>
                )}

                {/* 添加文本表情按钮 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddText(true)}
                >
                  <Plus className="mr-1 size-4" />
                  文本表情
                </Button>
              </div>

              {/* 添加文本表情弹窗 */}
              {showAddText && (
                <div className="flex gap-2 p-3 rounded-lg border bg-muted/50 shrink-0 mb-4">
                  <Input
                    placeholder="名称"
                    value={textForm.name}
                    onChange={(e) =>
                      setTextForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-32"
                  />
                  <Input
                    placeholder="文本内容（如：(・∀・)）"
                    value={textForm.textContent}
                    onChange={(e) =>
                      setTextForm((prev) => ({
                        ...prev,
                        textContent: e.target.value,
                      }))
                    }
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleAddTextEmoji}>
                    <Check className="mr-1 size-4" />
                    添加
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddText(false);
                      setTextForm({ name: "", textContent: "" });
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )}

              {/* 表情网格 */}
              <div className="flex-1 overflow-y-auto pr-1 -mr-1">
                {paginatedEmojis.length > 0 ? (
                  <>
                    {/* 选择模式下的全选按钮 */}
                    {isSelectMode && (
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={toggleSelectAll}
                        >
                          {paginatedEmojis.every((e) => selectedIds.has(e.id)) ? (
                            <>
                              <CheckSquare className="mr-1 size-4" />
                              取消全选当前页
                            </>
                          ) : (
                            <>
                              <Square className="mr-1 size-4" />
                              全选当前页
                            </>
                          )}
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          已选择 {selectedIds.size} 个
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7">
                      {paginatedEmojis.map((emoji) => (
                        <EmojiCard
                          key={emoji.id}
                          emoji={emoji}
                          isSelectMode={isSelectMode}
                          isSelected={selectedIds.has(emoji.id)}
                          onToggleSelect={() => toggleSelect(emoji.id)}
                          onEdit={() => startEdit(emoji)}
                          onDelete={() => handleDelete(emoji.id)}
                        />
                      ))}
                    </div>

                    {/* 分页 */}
                    {totalPages > 1 && (
                      <div className="mt-4">
                        <Pagination
                          currentPage={currentPage}
                          totalPages={totalPages}
                          onPageChange={setCurrentPage}
                        />
                      </div>
                    )}
                  </>
                ) : searchQuery ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Search className="size-8 mb-2" />
                    <p>未找到匹配的表情</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Images className="size-8 mb-2" />
                    <p>暂无表情</p>
                    <p className="text-sm mt-1">切换到"上传"标签页添加表情</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 上传标签页 */}
            <TabsContent value="upload" className="flex-1 overflow-y-auto mt-4">
              <EmojiUploader
                onUpload={handleUpload}
                maxFiles={20}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* 编辑弹窗 */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => setEditDialog({ open, emoji: null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑表情</DialogTitle>
            <DialogDescription>修改表情的名称和内容</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 预览 */}
            {editDialog.emoji && (
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-lg border flex items-center justify-center bg-muted/50">
                  {editDialog.emoji.url ? (
                    <img
                      src={getEmojiDisplay(editDialog.emoji)}
                      alt={editDialog.emoji.name}
                      className="w-full h-full rounded-lg object-contain"
                    />
                  ) : (
                    <span className="text-3xl">
                      {editDialog.emoji.textContent || editDialog.emoji.name}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 名称 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">名称</label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="表情名称"
              />
            </div>

            {/* URL 或文本内容 */}
            {editDialog.emoji?.url ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">图片链接</label>
                <Input
                  value={editForm.url}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, url: e.target.value }))
                  }
                  placeholder="URL"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">文本内容</label>
                <Input
                  value={editForm.textContent}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      textContent: e.target.value,
                    }))
                  }
                  placeholder="文本内容"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, emoji: null })}
            >
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateEmoji.isPending}>
              {updateEmoji.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
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

/** 表情卡片组件 */
interface EmojiCardProps {
  emoji: EmojiAdmin;
  isSelectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function EmojiCard({
  emoji,
  isSelectMode,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
}: EmojiCardProps) {
  return (
    <div
      className={`group relative rounded-lg border p-1 transition-all duration-200 cursor-pointer
        ${isSelectMode ? "cursor-pointer" : ""}
        ${isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:border-primary/50 hover:shadow-sm"}
      `}
      onClick={isSelectMode ? onToggleSelect : undefined}
    >
      {/* 选择模式下显示选择框 */}
      {isSelectMode && (
        <div className="absolute left-1 top-1 z-10">
          <div
            className={`size-5 rounded border-2 flex items-center justify-center transition-colors
              ${isSelected ? "bg-primary border-primary" : "bg-background/80 border-muted-foreground/30"}
            `}
          >
            {isSelected && <Check className="size-3 text-primary-foreground" />}
          </div>
        </div>
      )}

      {/* 表情内容 */}
      {emoji.url ? (
        <img
          src={getEmojiDisplay(emoji)}
          alt={emoji.name}
          className="aspect-square w-full rounded object-cover"
        />
      ) : (
        <div
          className="aspect-square w-full rounded flex items-center justify-center text-xl bg-muted"
          title={emoji.name}
        >
          {emoji.textContent || emoji.name}
        </div>
      )}

      {/* 操作按钮（非选择模式） */}
      {!isSelectMode && (
        <>
          <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex transition-opacity">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="bg-background/90 backdrop-blur-sm"
            >
              <Edit className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="bg-background/90 backdrop-blur-sm text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>

          {/* 名称标签 */}
          <div className="absolute bottom-1 left-1 right-1 hidden group-hover:block transition-opacity">
            <div className="flex items-center gap-0.5 rounded bg-background/90 backdrop-blur-sm px-1.5 py-0.5 text-xs">
              {emoji.url ? (
                <Link className="size-3 shrink-0" />
              ) : (
                <Type className="size-3 shrink-0" />
              )}
              <span className="truncate">{emoji.name}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}