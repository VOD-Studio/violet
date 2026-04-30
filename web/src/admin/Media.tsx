/**
 * 媒体库页面
 * 支持文件上传（图片、视频、音频、文档）、预览、删除
 * 上传区域使用弹窗展示，带动画效果
 */

import { useState } from "react"
import { useAdminMedia, useDeleteMedia } from "@/hooks/useAdmin"
import type { MediaItem } from "@/hooks/useAdmin"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorFallback } from "@/components/shared/ErrorFallback"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import FileUploader from "@/components/upload/FileUploader"
import FilePreview from "@/components/upload/FilePreview"
import MediaCard from "./MediaCard"
import type { UploadResult } from "@/components/upload/ChunkedUpload"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Image as ImageIcon, Upload } from "lucide-react"

/**
 * 媒体网格骨架屏
 */
function MediaGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-0">
            <Skeleton className="h-40 w-full" />
            <div className="p-3">
              <Skeleton className="mb-1 h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * 媒体库页面
 * 支持文件上传、预览、删除
 */
export default function Media() {
  const { data: mediaItems, isLoading, error, refetch } = useAdminMedia()
  const deleteMutation = useDeleteMedia()

  /** 上传区域显示状态 */
  const [showUploader, setShowUploader] = useState(false)

  /** 删除确认弹窗状态 */
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: "" })

  /** 预览弹窗状态 */
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)

  /**
   * 弹出删除确认
   */
  function handleDelete(id: string) {
    setDeleteConfirm({ open: true, id })
  }

  /**
   * 确认删除
   */
  function confirmDelete() {
    deleteMutation.mutate(deleteConfirm.id, {
      onSuccess: () => {
        toast.success("文件已删除")
        setDeleteConfirm({ open: false, id: "" })
      },
      onError: () => {
        toast.error("删除失败，请重试")
        setDeleteConfirm({ open: false, id: "" })
      },
    })
  }

  /**
   * 上传完成回调
   */
  function handleUploadComplete(result: UploadResult) {
    toast.success(`「${result.name}」上传成功`)
    refetch()
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">媒体库</h1>
          <p className="text-muted-foreground">管理上传的图片、视频、音频和文档</p>
        </div>
        <Button onClick={() => setShowUploader(true)}>
          <Upload className="mr-1.5 size-4" />
          上传文件
        </Button>
      </div>

      {/* 加载态 */}
      {isLoading && <MediaGridSkeleton />}

      {/* 错误状态 */}
      {error && (
        <ErrorFallback error={error.message} onRetry={refetch} />
      )}

      {/* 空数据状态 */}
      {!isLoading && !error && (!mediaItems || mediaItems.length === 0) && (
        <EmptyState
          title="暂无媒体文件"
          description="上传你的第一个文件开始管理媒体库"
          actionLabel="上传文件"
          onAction={() => setShowUploader(true)}
          icon={<ImageIcon className="size-12" />}
        />
      )}

      {/* 媒体网格展示 */}
      {!isLoading && !error && mediaItems && mediaItems.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {mediaItems.map((item: MediaItem) => (
            <MediaCard
              key={item.id}
              item={item}
              onDelete={handleDelete}
              onPreview={setPreviewItem}
            />
          ))}
        </div>
      )}

      {/* 文件预览弹窗 */}
      <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{previewItem?.original_name}</DialogTitle>
          </DialogHeader>
          {previewItem && (
            <div className="space-y-4">
              <FilePreview
                url={`/uploads/${previewItem.filename}`}
                mimeType={previewItem.mime_type}
                name={previewItem.original_name}
                size={previewItem.size}
              />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>类型: {previewItem.mime_type}</span>
                <span>大小: {formatSize(previewItem.size)}</span>
                <span>上传: {new Date(previewItem.created_at).toLocaleString("zh-CN")}</span>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    const a = document.createElement("a")
                    a.href = `/uploads/${previewItem.filename}`
                    a.download = previewItem.original_name
                    a.click()
                  }}
                >
                  下载文件
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 上传文件弹窗 */}
      <Dialog open={showUploader} onOpenChange={setShowUploader}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>上传文件</DialogTitle>
          </DialogHeader>
          <FileUploader
            onUpload={handleUploadComplete}
            multiple
          />
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: "" })}
        onConfirm={confirmDelete}
        title="删除文件"
        description="确定要删除这个文件吗？此操作不可撤销。"
        confirmLabel="删除"
        destructive
      />
    </div>
  )
}
