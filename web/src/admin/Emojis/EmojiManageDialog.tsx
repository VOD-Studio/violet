import { useState } from "react";
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
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import EmojiUploader, { type EmojiUploadResult } from "@/components/admin/EmojiUploader";
import { Trash2, Edit, Link, Type, Check, X } from "lucide-react";
import { toast } from "sonner";

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
  const { data: emojis } = useEmojisByGroup(groupId);
  const createEmoji = useCreateEmoji();
  const updateEmoji = useUpdateEmoji();
  const deleteEmoji = useDeleteEmoji();

  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: number;
  }>({
    open: false,
    id: 0,
  });

  const [editingEmoji, setEditingEmoji] = useState<EmojiAdmin | null>(null);
  const [editForm, setEditForm] = useState<CreateEmojiInput>({
    name: "",
    url: "",
    textContent: "",
  });
  const [showAddText, setShowAddText] = useState(false);
  const [textForm, setTextForm] = useState({ name: "", textContent: "" });

  function handleUpload(result: EmojiUploadResult) {
    const name = result.url.split("/").pop() || `emoji-${Date.now()}`;
    createEmoji.mutate(
      { groupId, data: { name, url: result.url } },
      {
        onSuccess: () => toast.success("表情已添加"),
        onError: () => toast.error("添加失败"),
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
      },
    );
  }

  function startEdit(emoji: EmojiAdmin) {
    setEditingEmoji(emoji);
    setEditForm({
      name: emoji.name,
      url: emoji.url || "",
      textContent: emoji.textContent || "",
    });
  }

  function handleSaveEdit() {
    if (!editingEmoji) return;
    if (!editForm.name.trim()) {
      toast.error("请填写名称");
      return;
    }
    updateEmoji.mutate(
      { id: editingEmoji.id, data: editForm },
      {
        onSuccess: () => {
          toast.success("表情已更新");
          setEditingEmoji(null);
        },
        onError: () => toast.error("更新失败"),
      },
    );
  }

  function handleDelete(id: number) {
    setDeleteConfirm({ open: true, id });
  }

  function confirmDelete() {
    deleteEmoji.mutate(deleteConfirm.id, {
      onSuccess: () => {
        toast.success("表情已删除");
        setDeleteConfirm({ open: false, id: 0 });
      },
      onError: () => {
        toast.error("删除失败");
        setDeleteConfirm({ open: false, id: 0 });
      },
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>管理表情</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <EmojiUploader onUpload={handleUpload} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddText(!showAddText)}
              >
                <Type className="mr-1 size-3.5" />
                {showAddText ? "取消" : "添加文本表情"}
              </Button>
            </div>

            {showAddText && (
              <div className="flex gap-2 p-3 rounded-lg border bg-muted/50">
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
                />
                <Button size="sm" onClick={handleAddTextEmoji}>
                  <Check className="mr-1 size-3.5" />
                  添加
                </Button>
              </div>
            )}

            {emojis && emojis.length > 0 && (
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
                {emojis.map((emoji) => (
                  <div
                    key={emoji.id}
                    className="group relative rounded-lg border p-1"
                  >
                    {editingEmoji?.id === emoji.id ? (
                      // 编辑模式
                      <div className="space-y-1 p-1">
                        <Input
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          className="h-6 text-xs"
                          placeholder="名称"
                        />
                        {emoji.url ? (
                          <Input
                            value={editForm.url}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                url: e.target.value,
                              }))
                            }
                            className="h-6 text-xs"
                            placeholder="URL"
                          />
                        ) : (
                          <Input
                            value={editForm.textContent}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                textContent: e.target.value,
                              }))
                            }
                            className="h-6 text-xs"
                            placeholder="文本"
                          />
                        )}
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={handleSaveEdit}
                          >
                            <Check className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setEditingEmoji(null)}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // 显示模式
                      <>
                        {emoji.url ? (
                          <img
                            src={getEmojiDisplay(emoji)}
                            alt={emoji.name}
                            className="aspect-square w-full rounded object-cover"
                          />
                        ) : (
                          <div
                            className="aspect-square w-full rounded flex items-center justify-center text-lg bg-muted"
                            title={emoji.name}
                          >
                            {emoji.textContent || emoji.name}
                          </div>
                        )}
                        <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => startEdit(emoji)}
                            className="bg-background/80"
                          >
                            <Edit className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleDelete(emoji.id)}
                            className="bg-background/80 text-destructive"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                        <div className="absolute bottom-1 left-1 right-1 hidden group-hover:block">
                          <div className="flex items-center gap-0.5 rounded bg-background/80 px-1 py-0.5 text-xs">
                            {emoji.url ? (
                              <Link className="size-2.5" />
                            ) : (
                              <Type className="size-2.5" />
                            )}
                            <span className="truncate">{emoji.name}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            {emojis && emojis.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                暂无表情，上传图片或添加文本表情
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: 0 })}
        onConfirm={confirmDelete}
        title="删除表情"
        description="确定要删除这个表情吗？此操作不可撤销。"
        confirmLabel="删除"
        destructive
        isLoading={deleteEmoji.isPending}
      />
    </>
  );
}