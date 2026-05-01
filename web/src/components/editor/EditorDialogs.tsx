// EditorDialogs.tsx
// 编辑器专用对话框组件：链接插入、图片插入

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Segmented } from "@/components/ui/Segmented"
import { Loader2 } from "lucide-react"
import { api, getUploadUrl } from "@/lib/api"

interface MediaItem {
  id: string
  filename: string
  original_name: string
  mime_type: string
  path: string
  width?: number
  height?: number
  created_at: string
}

/** 链接插入对话框属性 */
interface LinkDialogProps {
  open: boolean
  onClose: () => void
  onInsert: (url: string, text?: string) => void
  initialUrl?: string
}

/** 图片插入对话框属性 */
interface ImageDialogProps {
  open: boolean
  onClose: () => void
  onInsert: (src: string, alt?: string) => void
}

/** 图片来源选项 */
const sourceOptions = [
  { label: "输入 URL", value: "url" },
  { label: "素材库", value: "media" },
] as const

/**
 * 链接插入对话框
 */
export function LinkDialog({ open, onClose, onInsert, initialUrl }: LinkDialogProps) {
  const [url, setUrl] = useState(initialUrl ?? "")
  const [text, setText] = useState("")

  function handleInsert() {
    if (!url.trim()) return
    onInsert(url.trim(), text.trim() || undefined)
    setUrl("")
    setText("")
    onClose()
  }

  function handleClose() {
    setUrl("")
    setText("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>插入链接</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="link-url">链接地址</Label>
            <Input
              id="link-url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-text">显示文本（可选）</Label>
            <Input
              id="link-text"
              placeholder="链接显示的文字"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleInsert} disabled={!url.trim()}>
            插入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * 图片插入对话框
 * 支持 URL 输入和从素材库选择，使用 Segmented 组件切换
 */
export function ImageDialog({ open, onClose, onInsert }: ImageDialogProps) {
  const [source, setSource] = useState<"url" | "media">("url")
  const [url, setUrl] = useState("")
  const [alt, setAlt] = useState("")
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 加载素材库图片
  function loadMedia() {
    setLoading(true)
    api
      .get<{ media: MediaItem[] }>("/media", { type: "image" })
      .then((res) => {
        const images = (res.media ?? []).filter((m) =>
          m.mime_type.startsWith("image/")
        )
        setMedia(images)
      })
      .catch((err) => {
        console.error("加载素材库失败:", err)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  // 切换到素材库时加载数据
  function handleSourceChange(value: "url" | "media") {
    setSource(value)
    if (value === "media") {
      loadMedia()
    }
  }

  function handleInsertFromUrl() {
    if (!url.trim()) return
    onInsert(url.trim(), alt.trim() || undefined)
    resetAndClose()
  }

  function handleInsertFromMedia() {
    const selected = media.find((m) => m.id === selectedId)
    if (selected) {
      onInsert(getUploadUrl(selected.path), alt.trim() || selected.original_name)
      resetAndClose()
    }
  }

  function resetAndClose() {
    setUrl("")
    setAlt("")
    setSelectedId(null)
    setSource("url")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>插入图片</DialogTitle>
        </DialogHeader>

        {/* 使用 Segmented 切换来源 */}
        <div className="pt-4">
          <Segmented
            options={sourceOptions}
            value={source}
            onChange={handleSourceChange}
          />
        </div>

        {source === "url" ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="image-url">图片地址</Label>
              <Input
                id="image-url"
                placeholder="https://example.com/image.jpg"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image-alt">替代文本（可选）</Label>
              <Input
                id="image-alt"
                placeholder="图片描述"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose}>
                取消
              </Button>
              <Button onClick={handleInsertFromUrl} disabled={!url.trim()}>
                插入
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : media.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                素材库中没有图片，请先上传
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4 overflow-auto max-h-60">
                {media.map((item) => (
                  <div
                    key={item.id}
                    className={`relative aspect-square cursor-pointer rounded-lg border-2 overflow-hidden transition-colors ${
                      selectedId === item.id
                        ? "border-primary"
                        : "border-transparent"
                    }`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <img
                      src={getUploadUrl(item.path)}
                      alt={item.original_name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="media-alt">替代文本（可选）</Label>
              <Input
                id="media-alt"
                placeholder="图片描述"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose}>
                取消
              </Button>
              <Button onClick={handleInsertFromMedia} disabled={!selectedId}>
                插入
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}