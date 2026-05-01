/**
 * 媒体文件卡片组件
 * 展示文件预览（图片/视频/文件图标）、文件名、大小和日期
 * 支持点击预览和删除操作
 */

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { MediaItem } from "@/hooks/useAdmin"
import { getUploadUrl } from "@/lib/api"
import {
  Video,
  Music,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileArchive,
  File,
  Trash2,
  Play,
} from "lucide-react"

/** MediaCard 组件属性 */
interface MediaCardProps {
  /** 媒体文件数据 */
  item: MediaItem
  /** 删除回调 */
  onDelete: (id: string) => void
  /** 预览回调 */
  onPreview: (item: MediaItem) => void
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
 * 根据 MIME 类型获取文件类型描述
 */
function getFileTypeLabel(mimeType: string): string {
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
 * 根据 MIME 类型获取对应的 lucide 图标组件
 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("video/")) return Video
  if (mimeType.startsWith("audio/")) return Music
  if (mimeType.startsWith("image/")) return ImageIcon
  if (mimeType.includes("pdf")) return FileText
  if (mimeType.includes("word") || mimeType.includes("document")) return FileText
  if (mimeType.includes("excel") || mimeType.includes("sheet")) return FileSpreadsheet
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return Presentation
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z")) return FileArchive
  return File
}

/**
 * 视频封面展示组件
 * 优先使用缩略图，无缩略图时使用 video preload="metadata" 显示首帧
 */
function VideoThumbnail({
  filename,
  mimeType,
  originalName,
}: {
  filename: string
  mimeType: string
  originalName: string
}) {
  const ext = filename.includes(".") ? filename.split(".").pop() : ""
  const baseName = ext ? filename.slice(0, -(ext.length + 1)) : filename
  const thumbUrl = getUploadUrl(`${baseName}_thumb.jpg`)
  const videoUrl = getUploadUrl(filename)

  return (
    <div className="group/thumbnail relative size-full">
      <img
        src={thumbUrl}
        alt={originalName}
        className="size-full object-cover transition-transform duration-300 group-hover/thumbnail:scale-105"
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement
          const parent = target.parentElement
          if (!parent) return
          const video = document.createElement("video")
          video.className = "size-full object-cover transition-transform duration-300 group-hover/thumbnail:scale-105"
          video.preload = "metadata"
          video.muted = true
          const source = document.createElement("source")
          source.src = videoUrl
          source.type = mimeType
          video.appendChild(source)
          parent.replaceChild(video, target)
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
        <Play className="size-12 text-white" fill="currentColor" />
      </div>
    </div>
  )
}

/**
 * 媒体文件卡片
 */
export default function MediaCard({ item, onDelete, onPreview }: MediaCardProps) {
  const fileUrl = getUploadUrl(item.path)
  const isImage = item.mime_type.startsWith("image/")
  const isVideo = item.mime_type.startsWith("video/")
  const FileIcon = getFileIcon(item.mime_type)

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* 预览区域 */}
        <button
          onClick={() => onPreview(item)}
          className="group relative flex h-40 w-full cursor-pointer items-center justify-center overflow-hidden bg-muted"
        >
          {isImage ? (
            <img
              src={fileUrl}
              alt={item.original_name}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : isVideo ? (
            <VideoThumbnail
              filename={item.path}
              mimeType={item.mime_type}
              originalName={item.original_name}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <FileIcon className="size-10" />
              <span className="text-xs font-medium">{getFileTypeLabel(item.mime_type)}</span>
            </div>
          )}
        </button>
        {/* 文件信息 */}
        <div className="flex items-center justify-between gap-2 border-t p-3">
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
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
