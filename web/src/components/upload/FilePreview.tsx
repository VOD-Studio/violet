// 文件预览组件
// 支持图片、视频、音频、PDF 预览，其他文件类型显示图标和下载

import { useEffect, useRef } from "react"
import Plyr from "plyr"
import "plyr/dist/plyr.css"
import { Button } from "@/components/ui/button"
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  FileArchive,
  File,
  Download,
  Music,
} from "lucide-react"

/** 文件预览属性 */
interface FilePreviewProps {
  /** 文件 URL */
  url: string
  /** 文件 MIME 类型 */
  mimeType: string
  /** 文件名称 */
  name?: string
  /** 文件大小（字节） */
  size?: number
  /** 是否显示文件信息 */
  showInfo?: boolean
  /** 自定义类名 */
  className?: string
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

/**
 * 根据 MIME 类型获取文件图标
 */
function getFileIcon(mimeType: string) {
  if (mimeType.includes("pdf")) return FileText
  if (mimeType.includes("word") || mimeType.includes("document")) return FileText
  if (mimeType.includes("excel") || mimeType.includes("sheet")) return FileSpreadsheet
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return Presentation
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z") || mimeType.includes("tar") || mimeType.includes("gz")) return FileArchive
  if (mimeType.startsWith("audio/")) return Music
  return File
}

/**
 * 根据 MIME 类型获取文件类型描述
 */
function getFileTypeLabel(mimeType: string): string {
  if (mimeType.includes("pdf")) return "PDF 文档"
  if (mimeType.includes("word") || mimeType.includes("document")) return "Word 文档"
  if (mimeType.includes("excel") || mimeType.includes("sheet")) return "Excel 表格"
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "演示文稿"
  if (mimeType.includes("zip")) return "ZIP 压缩包"
  if (mimeType.includes("rar")) return "RAR 压缩包"
  if (mimeType.includes("7z")) return "7Z 压缩包"
  if (mimeType.includes("tar")) return "TAR 归档"
  if (mimeType.includes("gz")) return "GZ 压缩包"
  if (mimeType.startsWith("video/")) return "视频文件"
  if (mimeType.startsWith("audio/")) return "音频文件"
  if (mimeType.startsWith("image/")) return "图片文件"
  return "文件"
}

/**
 * 视频预览组件，使用 Plyr 播放器
 */
function VideoPlayer({ url, name, mimeType }: { url: string; name?: string; mimeType: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<Plyr | null>(null)

  useEffect(() => {
    if (!videoRef.current) return

    playerRef.current = new Plyr(videoRef.current, {
      controls: ["play-large", "play", "progress", "current-time", "mute", "volume", "fullscreen"],
    })

    return () => {
      playerRef.current?.destroy()
    }
  }, [url])

  return (
    <video ref={videoRef} className="w-full rounded-lg" playsInline>
      <source src={url} type={mimeType} />
      {name ?? "视频"}
    </video>
  )
}

/**
 * 不可预览文件的占位展示，显示图标、类型和下载按钮
 */
function FilePlaceholder({ url, name, mimeType }: { url: string; name?: string; mimeType: string }) {
  const Icon = getFileIcon(mimeType)
  const label = getFileTypeLabel(mimeType)

  function handleDownload() {
    const a = document.createElement("a")
    a.href = url
    a.download = name ?? "download"
    a.click()
  }

  return (
    <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
      <Icon className="size-12" />
      <div className="text-center">
        <p className="text-sm font-medium">{label}</p>
        {name && <p className="mt-1 max-w-[200px] truncate text-xs">{name}</p>}
      </div>
      <Button variant="outline" size="sm" onClick={handleDownload}>
        <Download className="mr-1.5 size-3.5" />
        下载文件
      </Button>
    </div>
  )
}

/**
 * 文件预览组件
 * 根据文件类型展示对应的预览界面
 */
export default function FilePreview({
  url,
  mimeType,
  name,
  size,
  showInfo = true,
  className = "",
}: FilePreviewProps) {
  const isImage = mimeType.startsWith("image/")
  const isVideo = mimeType.startsWith("video/")
  const isAudio = mimeType.startsWith("audio/")
  const isPDF = mimeType.includes("pdf")

  return (
    <div className={`space-y-2 ${className}`}>
      {/* 预览区域 */}
      <div className="overflow-hidden rounded-lg border bg-muted/30">
        {isImage && (
          <img
            src={url}
            alt={name ?? "预览图片"}
            className="max-h-[400px] w-full object-contain"
          />
        )}
        {isVideo && <VideoPlayer url={url} name={name} mimeType={mimeType} />}
        {isAudio && (
          <div className="p-4">
            <audio controls className="w-full">
              <source src={url} type={mimeType} />
              您的浏览器不支持音频播放
            </audio>
          </div>
        )}
        {isPDF && (
          <iframe
            src={url}
            title={name ?? "PDF 预览"}
            className="h-[500px] w-full"
          />
        )}
        {!isImage && !isVideo && !isAudio && !isPDF && (
          <FilePlaceholder url={url} name={name} mimeType={mimeType} />
        )}
      </div>

      {/* 文件信息 */}
      {showInfo && name && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="truncate">{name}</span>
          {size !== undefined && <span>{formatFileSize(size)}</span>}
        </div>
      )}
    </div>
  )
}
