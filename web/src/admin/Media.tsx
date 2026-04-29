/**
 * 媒体库页面
 * 展示已上传的图片网格，支持上传和删除操作
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"

/** 媒体文件数据项 */
interface MediaItem {
  /** 文件 ID */
  id: number
  /** 文件名称 */
  name: string
  /** 缩略图 URL（示例使用占位色块） */
  thumbnail: string
  /** 文件大小 */
  size: string
  /** 上传时间 */
  uploadedAt: string
}

/** 媒体库示例数据 */
const mockMedia: MediaItem[] = [
  { id: 1, name: "react-cover.jpg", thumbnail: "bg-blue-200", size: "245 KB", uploadedAt: "2026-04-28" },
  { id: 2, name: "typescript-banner.png", thumbnail: "bg-blue-300", size: "312 KB", uploadedAt: "2026-04-25" },
  { id: 3, name: "tailwind-logo.svg", thumbnail: "bg-cyan-200", size: "18 KB", uploadedAt: "2026-04-20" },
  { id: 4, name: "vite-config.png", thumbnail: "bg-purple-200", size: "189 KB", uploadedAt: "2026-04-18" },
  { id: 5, name: "docker-setup.jpg", thumbnail: "bg-sky-200", size: "402 KB", uploadedAt: "2026-04-15" },
  { id: 6, name: "git-workflow.png", thumbnail: "bg-orange-200", size: "156 KB", uploadedAt: "2026-04-10" },
  { id: 7, name: "nextjs-og.jpg", thumbnail: "bg-gray-200", size: "278 KB", uploadedAt: "2026-04-08" },
  { id: 8, name: "nodejs-api.png", thumbnail: "bg-green-200", size: "195 KB", uploadedAt: "2026-04-05" },
]

/**
 * 媒体库页面
 * 以网格形式展示媒体文件，支持上传和删除
 */
export default function Media() {
  /** 媒体文件列表 */
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(mockMedia)

  /**
   * 删除媒体文件
   * @param id - 文件 ID
   */
  function deleteMedia(id: number) {
    setMediaItems((prev) => prev.filter((item) => item.id !== id))
  }

  /**
   * 处理文件上传
   * 后续对接实际上传逻辑
   */
  function handleUpload() {
    console.log("触发文件上传")
  }

  return (
    <div className="space-y-6">
      {/* 页面头部：标题和上传按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">媒体库</h1>
          <p className="text-muted-foreground">管理上传的图片和文件</p>
        </div>
        <Button onClick={handleUpload}>上传文件</Button>
      </div>

      {/* 图片网格展示 */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {mediaItems.map((item) => (
          <Card key={item.id} className="group overflow-hidden">
            <CardContent className="p-0">
              {/* 图片预览占位区域 */}
              <div
                className={`flex h-40 items-center justify-center ${item.thumbnail}`}
              >
                <span className="text-3xl opacity-50">🖼️</span>
              </div>
              {/* 文件信息 */}
              <div className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.size} · {item.uploadedAt}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => deleteMedia(item.id)}
                >
                  🗑️
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* 上传占位卡片 */}
        <button
          onClick={handleUpload}
          className="flex h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <span className="text-3xl">+</span>
          <span className="mt-1 text-sm">上传新文件</span>
        </button>
      </div>
    </div>
  )
}
