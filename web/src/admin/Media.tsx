/**
 * 媒体库页面
 * 支持文件上传（图片、视频、音频、文档）、预览、删除
 * 使用 sonner 通知，ConfirmDialog 确认删除
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
import type { UploadResult } from "@/components/upload/ChunkedUpload"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
 * 获取文件类型的图标
 */
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("video/")) return "视频"
  if (mimeType.startsWith("audio/")) return "音频"
  if (mimeType.startsWith("image/")) return "图片"
  if (mimeType.includes("pdf")) return "PDF"
  if (mimeType.includes("word") || mimeType.includes("document")) return "文档"
  if (mimeType.includes("excel") || mimeType.includes("sheet")) return "表格"
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "演示"
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z")) return "压缩包"
  return "文件"
}

/**
 * 单个媒体文件卡片
 */
function MediaCard({
  item,
  onDelete,
  onPreview,
}: {
  item: MediaItem
  onDelete: (id: string) => void
  onPreview: (item: MediaItem) => void
}) {
  const fileUrl = `/uploads/${item.filename}`
  const isImage = item.mime_type.startsWith("image/")
  const isVideo = item.mime_type.startsWith("video/")

  return (
    <Card className="group overflow-hidden">
      <CardContent className="p-0">
        {/* 预览区域 */}
        <button
          onClick={() => onPreview(item)}
          className="flex h-40 w-full cursor-pointer items-center justify-center bg-muted transition-colors hover:bg-muted/80"
        >
          {isImage ? (
            <img
              src={fileUrl}
              alt={item.original_name}
              className="size-full object-cover"
            />
          ) : isVideo ? (
            <div className="relative size-full">
              <video className="size-full object-cover" preload="metadata">
                <source src={fileUrl} type={item.mime_type} />
              </video>
              {/* 播放按钮覆盖层 */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <svg className="size-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <svg className="size-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span className="text-xs font-medium">{getFileIcon(item.mime_type)}</span>
            </div>
          )}
        </button>
        {/* 文件信息 */}
        <div className="flex items-center justify-between p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.original_name}</p>
            <p className="text-xs text-muted-foreground">
              {formatSize(item.size)} · {new Date(item.created_at).toLocaleDateString("zh-CN")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => onDelete(item.id)}
          >
            <svg className="size-4 text-destructive" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
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
        <Button onClick={() => setShowUploader(!showUploader)}>
          {showUploader ? "收起上传" : "上传文件"}
        </Button>
      </div>

      {/* 上传区域 */}
      {showUploader && (
        <FileUploader
          onUpload={handleUploadComplete}
          multiple
        />
      )}

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
          icon={
            <svg className="size-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M2.25 18V6.75a2.25 2.25 0 012.25-2.25h15a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 18z" />
            </svg>
          }
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

          {/* 上传占位卡片 */}
          <button
            onClick={() => setShowUploader(true)}
            className="flex h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <svg className="size-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="mt-1 text-sm">上传新文件</span>
          </button>
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
