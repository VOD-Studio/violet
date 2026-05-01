import { useState } from "react"
import { useStickers, useCreateSticker, useUpdateSticker, useDeleteSticker } from "@/hooks/useStickersAdmin"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import StickerUploader from "@/components/admin/StickerUploader"
import type { UploadResult } from "@/components/upload/ChunkedUpload"
import { getUploadUrl } from "@/lib/api"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

interface StickerManageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
}

export function StickerManageDialog({
  open,
  onOpenChange,
  groupId,
}: StickerManageDialogProps) {
  const { data: stickers } = useStickers(groupId)
  const createSticker = useCreateSticker()
  const updateSticker = useUpdateSticker()
  const deleteSticker = useDeleteSticker()

  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string }>({
    open: false,
    id: "",
  })

  function handleUpload(result: UploadResult) {
    createSticker.mutate(
      { groupId, url: result.url },
      {
        onSuccess: () => toast.success("表情包已添加"),
        onError: () => toast.error("添加失败"),
      }
    )
  }

  function handleToggle(stickerId: string, currentEnabled: boolean) {
    updateSticker.mutate(
      { id: stickerId, data: { is_active: !currentEnabled } },
      {
        onSuccess: () => toast.success(!currentEnabled ? "已启用" : "已禁用"),
        onError: () => toast.error("操作失败"),
      }
    )
  }

  function handleDelete(id: string) {
    setDeleteConfirm({ open: true, id })
  }

  function confirmDelete() {
    deleteSticker.mutate(deleteConfirm.id, {
      onSuccess: () => {
        toast.success("表情包已删除")
        setDeleteConfirm({ open: false, id: "" })
      },
      onError: () => {
        toast.error("删除失败")
        setDeleteConfirm({ open: false, id: "" })
      },
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>管理表情包</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <StickerUploader onUpload={handleUpload} />

            {stickers && stickers.length > 0 && (
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
                {stickers.map((sticker) => (
                  <div
                    key={sticker.id}
                    className={`group relative rounded-lg border p-1 ${
                      sticker.is_active ? "" : "opacity-50"
                    }`}
                  >
                    <img
                      src={getUploadUrl(sticker.image_url)}
                      alt="sticker"
                      className="aspect-square w-full rounded object-cover"
                    />
                    <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleToggle(sticker.id, sticker.is_active)}
                        className="bg-background/80"
                      >
                        {sticker.is_active ? (
                          <span className="text-xs">禁</span>
                        ) : (
                          <span className="text-xs">启</span>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDelete(sticker.id)}
                        className="bg-background/80 text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {stickers && stickers.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                暂无表情包，上传图片添加表情包
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: "" })}
        onConfirm={confirmDelete}
        title="删除表情包"
        description="确定要删除这个表情包吗？此操作不可撤销。"
        confirmLabel="删除"
        destructive
        isLoading={deleteSticker.isPending}
      />
    </>
  )
}