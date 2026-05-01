/**
 * 媒体库页面
 * 支持文件上传（图片、视频、音频、文档）、分类筛选、无限滚动、预览、删除
 */

import { useState, useCallback } from "react"
import { motion } from "motion/react"
import { fetchMediaPage, useDeleteMedia } from "@/hooks/useAdmin"
import type { MediaItem } from "@/hooks/useAdmin"
import { usePaginatedQuery, useInfiniteScroll } from "@/hooks/useInfiniteScroll"
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
import { getUploadUrl } from "@/lib/api"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Image as ImageIcon, Upload } from "lucide-react"

/** 分类筛选项 */
interface CategoryTab {
  label: string
  mimeType?: string
}

const categories: CategoryTab[] = [
  { label: "全部" },
  { label: "图片", mimeType: "image" },
  { label: "视频", mimeType: "video" },
  { label: "音频", mimeType: "audio" },
  { label: "文档", mimeType: "application" },
]

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
            <div className="border-t p-3">
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
 * 带滑块动画的分类标签
 */
function CategoryTabs({
  active,
  onChange,
}: {
  active: number
  onChange: (index: number) => void
}) {
  return (
    <div className="relative flex gap-1 rounded-lg border bg-muted/30 p-1">
      {categories.map((cat, i) => (
        <button
          key={cat.label}
          onClick={() => onChange(i)}
          className={`relative z-10 flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            i === active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {cat.label}
          {i === active && (
            <motion.div
              layoutId="category-indicator"
              className="absolute inset-0 -z-10 rounded-md bg-background shadow-sm"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  )
}

/**
 * 媒体库页面
 */
export default function Media() {
  const [category, setCategory] = useState(0)
  const deleteMutation = useDeleteMedia()

  const [showUploader, setShowUploader] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: "" })
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)

  const currentMimeType = categories[category].mimeType

  const fetchFn = useCallback(
    (page: number, limit: number) => fetchMediaPage(page, limit, currentMimeType),
    [currentMimeType],
  )

  const {
    items: mediaItems,
    isLoading,
    error,
    hasMore,
    loadMore,
    reload,
  } = usePaginatedQuery<MediaItem>(
    ["admin", "media", currentMimeType ?? "all"],
    fetchFn,
    20,
  )

  const sentinelRef = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore: loadMore,
  })

  function handleCategoryChange(index: number) {
    if (index === category) return
    setCategory(index)
  }

  function handleDelete(id: string) {
    setDeleteConfirm({ open: true, id })
  }

  function confirmDelete() {
    deleteMutation.mutate(deleteConfirm.id, {
      onSuccess: () => {
        toast.success("文件已删除")
        setDeleteConfirm({ open: false, id: "" })
        reload()
      },
      onError: () => {
        toast.error("删除失败，请重试")
        setDeleteConfirm({ open: false, id: "" })
      },
    })
  }

  function handleUploadComplete(result: UploadResult) {
    toast.success(`「${result.name}」上传成功`)
    reload()
  }

  const isEmpty = !isLoading && !error && mediaItems.length === 0

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

      {/* 分类筛选（带滑块动画） */}
      <CategoryTabs active={category} onChange={handleCategoryChange} />

      {/* 加载态（首次） */}
      {isLoading && mediaItems.length === 0 && <MediaGridSkeleton />}

      {/* 错误状态 */}
      {error && <ErrorFallback error={error} onRetry={reload} />}

      {/* 空数据状态 */}
      {isEmpty && (
        <EmptyState
          title="暂无媒体文件"
          description="上传你的第一个文件开始管理媒体库"
          actionLabel="上传文件"
          onAction={() => setShowUploader(true)}
          icon={<ImageIcon className="size-12" />}
        />
      )}

      {/* 媒体网格 */}
      {mediaItems.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {mediaItems.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onDelete={handleDelete}
              onPreview={setPreviewItem}
            />
          ))}
        </div>
      )}

      {/* 无限滚动哨兵 */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {isLoading && (
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
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
                url={getUploadUrl(previewItem.filename)}
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
                    a.href = getUploadUrl(previewItem.filename)
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
          <FileUploader onUpload={handleUploadComplete} multiple />
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
