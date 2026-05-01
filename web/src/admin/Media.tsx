/**
 * 媒体库页面
 * 支持文件上传（图片、视频、音频、文档）、分类筛选、无限滚动、预览、删除
 */

import { useState, useCallback, useEffect } from "react"
import { fetchMediaPage, useDeleteMedia, useBatchDeleteMedia } from "@/hooks/useAdmin"
import type { MediaItem } from "@/hooks/useAdmin"
import { usePaginatedQuery, useInfiniteScroll } from "@/hooks/useInfiniteScroll"
import { Button } from "@/components/ui/button"
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
import { Segmented } from "@/components/ui/Segmented"
import { Image as ImageIcon, Upload, CheckSquare, Trash2 } from "lucide-react"

/** 分类选项 */
const categoryOptions = [
  { label: "全部", value: "all" },
  { label: "图片", value: "image" },
  { label: "视频", value: "video" },
  { label: "音频", value: "audio" },
  { label: "文档", value: "application" },
]

/**
 * 媒体网格骨架屏
 */
function MediaGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card overflow-hidden">
          <Skeleton className="h-40 w-full" />
          <div className="border-t p-3">
            <Skeleton className="mb-1 h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
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
 */
export default function Media() {
  const [category, setCategory] = useState<string>("all")
  const deleteMutation = useDeleteMedia()
  const batchDeleteMutation = useBatchDeleteMedia()

  const [showUploader, setShowUploader] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: "" })
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)
  const [previewReady, setPreviewReady] = useState(false)

  // 批量选择状态
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)

  // 延迟渲染预览内容，等待 Dialog 动画完成
  useEffect(() => {
    if (previewItem) {
      setPreviewReady(false)
      const timer = setTimeout(() => setPreviewReady(true), 150)
      return () => clearTimeout(timer)
    } else {
      setPreviewReady(false)
    }
  }, [previewItem])

  const currentMimeType = category === "all" ? undefined : category

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
    ["admin", "media", category],
    fetchFn,
    20,
  )

  const sentinelRef = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore: loadMore,
  })

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

  // 切换选择模式
  function toggleSelectMode() {
    setSelectMode(!selectMode)
    setSelectedIds(new Set())
  }

  // 选择/取消选择单个文件
  function toggleSelect(id: string) {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  // 全选当前页
  function selectAll() {
    const allIds = new Set(mediaItems.map((item) => item.id))
    setSelectedIds(allIds)
  }

  // 清空选择
  function clearSelection() {
    setSelectedIds(new Set())
  }

  // 批量删除
  function confirmBatchDelete() {
    const ids = Array.from(selectedIds)
    batchDeleteMutation.mutate(ids, {
      onSuccess: (data) => {
        toast.success(`已删除 ${data.count} 个文件`)
        setBatchDeleteConfirm(false)
        setSelectMode(false)
        setSelectedIds(new Set())
        reload()
      },
      onError: () => {
        toast.error("批量删除失败，请重试")
        setBatchDeleteConfirm(false)
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
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                清空选择 ({selectedIds.size})
              </Button>
              <Button variant="outline" size="sm" onClick={selectAll}>
                全选当前页
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBatchDeleteConfirm(true)}
                >
                  <Trash2 className="mr-1.5 size-4" />
                  删除 ({selectedIds.size})
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={toggleSelectMode}>
                取消
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={toggleSelectMode}>
                <CheckSquare className="mr-1.5 size-4" />
                批量选择
              </Button>
              <Button onClick={() => setShowUploader(true)}>
                <Upload className="mr-1.5 size-4" />
                上传文件
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 分类筛选（带滑块动画） */}
      <Segmented
        options={categoryOptions}
        value={category}
        onChange={setCategory}
      />

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
              onDelete={selectMode ? undefined : handleDelete}
              onPreview={selectMode ? undefined : setPreviewItem}
              selectMode={selectMode}
              selected={selectedIds.has(item.id)}
              onSelect={toggleSelect}
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
          {previewItem && previewReady && (
            <div className="space-y-4">
              <FilePreview
                url={getUploadUrl(previewItem.path)}
                thumbnailUrl={previewItem.thumbnail ? getUploadUrl(previewItem.thumbnail) : undefined}
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
                    a.href = getUploadUrl(previewItem.path)
                    a.download = previewItem.original_name
                    a.click()
                  }}
                >
                  下载文件
                </Button>
              </div>
            </div>
          )}
          {previewItem && !previewReady && (
            <div className="flex items-center justify-center py-20">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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

      {/* 批量删除确认弹窗 */}
      <ConfirmDialog
        open={batchDeleteConfirm}
        onClose={() => setBatchDeleteConfirm(false)}
        onConfirm={confirmBatchDelete}
        title="批量删除文件"
        description={`确定要删除选中的 ${selectedIds.size} 个文件吗？此操作不可撤销。`}
        confirmLabel="删除"
        destructive
      />
    </div>
  )
}
