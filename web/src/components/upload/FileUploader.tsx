// 文件上传组件
// 支持拖拽上传、多文件、上传进度、完成后预览

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { uploadFile, captureVideoThumbnail, uploadVideoThumbnail, type UploadResult } from "./ChunkedUpload"
import { Button } from "@/components/ui/button"
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react"

/** 单个文件上传状态 */
interface FileUploadItem {
  /** 临时 ID */
  id: string
  /** 文件对象 */
  file: File
  /** 上传进度 0-100 */
  progress: number
  /** 上传状态 */
  status: "pending" | "uploading" | "done" | "error"
  /** 上传结果 */
  result?: UploadResult
  /** 错误信息 */
  error?: string
}

/** FileUploader 组件属性 */
interface FileUploaderProps {
  /** 上传完成回调 */
  onUpload?: (result: UploadResult) => void
  /** 接受的文件类型 */
  accept?: Record<string, string[]>
  /** 单文件最大体积（字节） */
  maxSize?: number
  /** 是否支持多文件 */
  multiple?: boolean
  /** 自定义类名 */
  className?: string
}

/** 默认接受的文件类型 */
const defaultAccept: Record<string, string[]> = {
  "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
  "video/*": [".mp4", ".webm", ".mov", ".avi", ".mkv"],
  "audio/*": [".mp3", ".wav", ".ogg", ".flac", ".aac"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "application/zip": [".zip"],
  "application/vnd.rar": [".rar"],
  "application/x-7z-compressed": [".7z"],
}

/**
 * 生成临时唯一 ID
 */
function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * 文件上传组件
 * 使用 react-dropzone 实现拖拽上传，支持大文件分片上传和断点续传
 */
export default function FileUploader({
  onUpload,
  accept = defaultAccept,
  maxSize = 1024 * 1024 * 1024,
  multiple = true,
  className = "",
}: FileUploaderProps) {
  /** 上传队列 */
  const [items, setItems] = useState<FileUploadItem[]>([])

  /**
   * 更新指定文件的上传状态
   */
  const updateItem = useCallback((id: string, updates: Partial<FileUploadItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    )
  }, [])

  /**
   * 执行单个文件上传
   */
  const handleUpload = useCallback(
    async (item: FileUploadItem) => {
      updateItem(item.id, { status: "uploading", progress: 0 })

      try {
        const result = await uploadFile(item.file, (progress) => {
          updateItem(item.id, { progress })
        })

        updateItem(item.id, { status: "done", progress: 100, result })
        onUpload?.(result)

        // 视频文件：截取封面缩略图并上传
        if (result.mimeType.startsWith("video/") && result.id) {
          captureVideoThumbnail(item.file).then((blob) => {
            if (blob) uploadVideoThumbnail(result.id, item.file, blob)
          })
        }
      } catch (err) {
        updateItem(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "上传失败",
        })
      }
    },
    [updateItem, onUpload],
  )

  /**
   * 处理文件选择
   */
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newItems: FileUploadItem[] = acceptedFiles.map((file) => ({
        id: generateId(),
        file,
        progress: 0,
        status: "pending" as const,
      }))

      setItems((prev) => [...prev, ...newItems])

      // 开始上传
      for (const item of newItems) {
        handleUpload(item)
      }
    },
    [handleUpload],
  )

  /**
   * 移除上传项
   */
  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple,
  })

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 拖拽上传区域 */}
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary hover:bg-muted/50"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
        {isDragActive ? (
          <p className="text-sm font-medium text-primary">松开鼠标上传文件</p>
        ) : (
          <div className="text-center">
            <p className="text-sm font-medium">
              拖拽文件到此处，或点击选择文件
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              支持图片、视频、音频、文档等文件，最大 1GB
            </p>
          </div>
        )}
      </div>

      {/* 上传列表 */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              {/* 状态图标 */}
              <div className="flex-shrink-0">
                {item.status === "uploading" && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                {item.status === "pending" && (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
                {item.status === "done" && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                {item.status === "error" && (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
              </div>

              {/* 文件信息和进度 */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.file.name}</p>
                {item.status === "uploading" && (
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === "error" && (
                  <p className="mt-0.5 text-xs text-destructive">{item.error}</p>
                )}
                {item.status === "done" && item.result && (
                  <p className="mt-0.5 text-xs text-green-600">上传完成</p>
                )}
              </div>

              {/* 进度百分比 */}
              {item.status === "uploading" && (
                <span className="flex-shrink-0 text-xs text-muted-foreground">
                  {item.progress}%
                </span>
              )}

              {/* 移除按钮 */}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeItem(item.id)}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
