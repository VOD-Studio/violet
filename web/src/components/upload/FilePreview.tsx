// 文件预览组件
// 支持图片、视频、音频的预览展示

import { useEffect, useRef } from "react"
import Plyr from "plyr"
import "plyr/dist/plyr.css"

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
 * @param bytes - 字节数
 * @returns 格式化后的大小字符串
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

/**
 * 视频预览组件
 * 使用 Plyr 播放器
 */
function VideoPlayer({ url, name }: { url: string; name?: string }) {
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
      <source src={url} type="video/mp4" />
      <track kind="captions" label="中文字幕" srcLang="zh" default />
      {name ?? "视频"}
    </video>
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
        {isVideo && <VideoPlayer url={url} name={name} />}
        {isAudio && (
          <div className="p-4">
            <audio controls className="w-full">
              <source src={url} type={mimeType} />
              您的浏览器不支持音频播放
            </audio>
          </div>
        )}
        {!isImage && !isVideo && !isAudio && (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            不支持预览此文件类型
          </div>
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
