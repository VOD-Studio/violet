/**
 * 媒体库页面
 * 从 API 获取已上传的图片列表，支持上传和删除操作
 * 无 mock 数据，API 不存在时显示空状态
 */

import { useRef } from "react"
import { useAdminMedia, useDeleteMedia } from "@/hooks/useAdmin"
import type { MediaItem } from "@/hooks/useAdmin"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorFallback } from "@/components/shared/ErrorFallback"
import { Skeleton } from "@/components/ui/skeleton"

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
 * 单个媒体文件卡片
 */
function MediaCard({ item, onDelete }: { item: MediaItem; onDelete: (id: number) => void }) {
  return (
    <Card className="group overflow-hidden">
      <CardContent className="p-0">
        {/* 图片预览 */}
        <div className="flex h-40 items-center justify-center bg-muted">
          {item.thumbnail ? (
            <img src={item.thumbnail} alt={item.name} className="size-full object-cover" />
          ) : (
            <svg className="size-10 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M2.25 18V6.75a2.25 2.25 0 012.25-2.25h15a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 18z" />
            </svg>
          )}
        </div>
        {/* 文件信息 */}
        <div className="flex items-center justify-between p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatSize(item.size)} · {new Date(item.createdAt).toLocaleDateString("zh-CN")}
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
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 媒体库页面
 * 从 API 获取媒体文件列表，支持上传和删除
 */
export default function Media() {
  const { data: mediaItems, isLoading, error, refetch } = useAdminMedia()
  const deleteMutation = useDeleteMedia()
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * 删除媒体文件
   */
  function handleDelete(id: number) {
    if (!window.confirm("确定要删除这个文件吗？此操作不可撤销。")) return
    deleteMutation.mutate(id)
  }

  /**
   * 触发文件选择
   */
  function handleUpload() {
    fileInputRef.current?.click()
  }

  /**
   * 处理文件上传
   */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append("file", file)

    try {
      await api.post("/images/upload", formData)
      refetch()
    } catch {
      alert("上传失败，请重试")
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-6">
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">媒体库</h1>
          <p className="text-muted-foreground">管理上传的图片和文件</p>
        </div>
        <Button onClick={handleUpload}>上传文件</Button>
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
          description="上传你的第一张图片开始管理媒体库"
          actionLabel="上传文件"
          onAction={handleUpload}
          icon={
            <svg className="size-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M2.25 18V6.75a2.25 2.25 0 012.25-2.25h15a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 18z" />
            </svg>
          }
        />
      )}

      {/* 图片网格展示 */}
      {!isLoading && !error && mediaItems && mediaItems.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {mediaItems.map((item: MediaItem) => (
            <MediaCard key={item.id} item={item} onDelete={handleDelete} />
          ))}

          {/* 上传占位卡片 */}
          <button
            onClick={handleUpload}
            className="flex h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <svg className="size-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="mt-1 text-sm">上传新文件</span>
          </button>
        </div>
      )}
    </div>
  )
}
