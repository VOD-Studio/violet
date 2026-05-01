/**
 * 文章编辑页面
 * 支持新建和编辑文章，调用后端 API 保存数据
 * 包含标题、内容、标签、摘要和 SEO 设置
 */

import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router"
import { api } from "@/lib/api"
import { useAdminTags, useSavePost } from "@/hooks/useAdmin"
import type { ApiPost } from "@/hooks/useAdmin"
import { RichTextEditor } from "@/components/editor"
import { uploadFile, type UploadResult } from "@/components/upload/ChunkedUpload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Camera, X, Loader2 } from "lucide-react"

/**
 * 文章编辑页面
 * 新建模式下显示空表单，编辑模式下加载现有文章数据
 */
export default function PostEdit() {
  const navigate = useNavigate()
  /** 从路由参数中获取文章 ID */
  const { id } = useParams()
  /** 是否为编辑模式 */
  const isEditing = Boolean(id)

  /** 标签列表（从 API 获取） */
  const { data: availableTags = [], isLoading: tagsLoading } = useAdminTags()
  /** 文章保存 Hook */
  const saveMutation = useSavePost()

  /* 表单状态 */
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [coverImage, setCoverImage] = useState("")
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [seoDescription, setSeoDescription] = useState("")
  const [seoKeywords, setSeoKeywords] = useState("")
  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)

  /* 编辑模式下加载文章数据 */
  useEffect(() => {
    if (!id) return

    async function loadPost() {
      try {
        setPageLoading(true)
        setPageError(null)
        const post = await api.get<ApiPost>(`/posts/id/${id}`)
        setTitle(post.title)
        setContent(post.contentMarkdown ?? "")
        setExcerpt(post.excerpt ?? "")
        setCoverImage(post.coverImage ?? "")
        setSelectedTagIds(post.tags?.map((t) => t.id) ?? [])
        setSeoDescription(post.seoDescription ?? "")
        setSeoKeywords(post.seoKeywords ?? "")
      } catch (err) {
        setPageError(err instanceof Error ? err.message : "加载文章失败")
      } finally {
        setPageLoading(false)
      }
    }

    loadPost()
  }, [id])

  /**
   * 切换标签的选中状态
   * @param tagId - 标签 ID
   */
  function toggleTag(tagId: number) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((t) => t !== tagId)
        : [...prev, tagId],
    )
  }

  /**
   * 处理封面图上传
   */
  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingCover(true)
    try {
      const result: UploadResult = await uploadFile(file)
      setCoverImage(result.url)
    } catch (err) {
      console.error("封面图上传失败:", err)
    } finally {
      setUploadingCover(false)
    }
  }

  /**
   * 清除封面图
   */
  function clearCover() {
    setCoverImage("")
  }

  /**
   * 保存文章（草稿或发布）
   * @param status - 目标状态，draft 为草稿，published 为发布
   */
  async function handleSave(status: "draft" | "published" = "draft") {
    try {
      await saveMutation.mutateAsync({
        data: {
          title,
          contentMarkdown: content,
          excerpt: excerpt || undefined,
          coverImage: coverImage || undefined,
          status,
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
          seoDescription: seoDescription || undefined,
          seoKeywords: seoKeywords || undefined,
        },
        id: isEditing ? Number(id) : undefined,
      })
      navigate("/admin/posts")
    } catch {
      /* 错误由 saveMutation 处理 */
    }
  }

  if (pageLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? "编辑文章" : "新建文章"}
          </h1>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (pageError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? "编辑文章" : "新建文章"}
          </h1>
          <p className="text-destructive">{pageError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? "编辑文章" : "新建文章"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "修改文章内容" : "撰写新的博客文章"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/posts")}>
            取消
          </Button>
          <Button
            variant="secondary"
            disabled={saveMutation.isPending}
            onClick={() => handleSave("draft")}
          >
            {saveMutation.isPending ? "保存中..." : "保存草稿"}
          </Button>
          <Button disabled={saveMutation.isPending} onClick={() => handleSave("published")}>
            {saveMutation.isPending ? "发布中..." : "发布"}
          </Button>
        </div>
      </div>

      {/* 保存错误提示 */}
      {saveMutation.error && (
        <p className="text-sm text-destructive">{saveMutation.error.message}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* 左侧主编辑区 */}
        <div className="space-y-6">
          {/* 标题输入 */}
          <div className="space-y-2">
            <Label htmlFor="title">文章标题</Label>
            <Input
              id="title"
              placeholder="请输入文章标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg"
            />
          </div>

          {/* 摘要输入 */}
          <div className="space-y-2">
            <Label htmlFor="excerpt">文章摘要</Label>
            <Textarea
              id="excerpt"
              placeholder="请输入文章摘要（可选）"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="min-h-[80px] resize-y"
            />
          </div>

          {/* 内容编辑区域 */}
          <div className="space-y-2">
            <Label>文章内容</Label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="请输入文章内容"
            />
          </div>
        </div>

        {/* 右侧设置面板 */}
        <div className="space-y-6">
          {/* 标签选择 */}
          <Card>
            <CardHeader>
              <CardTitle>文章标签</CardTitle>
              <CardDescription>选择文章相关标签</CardDescription>
            </CardHeader>
            <CardContent>
              {tagsLoading ? (
                <p className="text-sm text-muted-foreground">加载标签中...</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={
                        selectedTagIds.includes(tag.id) ? "default" : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                  {availableTags.length === 0 && (
                    <p className="text-sm text-muted-foreground">暂无可用标签</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 封面图上传 */}
          <Card>
            <CardHeader>
              <CardTitle>封面图</CardTitle>
              <CardDescription>上传文章封面图片</CardDescription>
            </CardHeader>
            <CardContent>
              {coverImage ? (
                <div className="relative aspect-video overflow-hidden rounded-lg">
                  <img
                    src={coverImage}
                    alt="封面图"
                    className="h-full w-full object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    className="absolute right-2 top-2"
                    onClick={clearCover}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex h-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverUpload}
                    disabled={uploadingCover}
                  />
                  <div className="text-center">
                    {uploadingCover ? (
                      <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                    ) : (
                      <Camera className="mx-auto h-8 w-8" />
                    )}
                    <p className="mt-1 text-sm">
                      {uploadingCover ? "上传中..." : "点击上传封面图"}
                    </p>
                  </div>
                </label>
              )}
            </CardContent>
          </Card>

          {/* SEO 设置 */}
          <Card>
            <CardHeader>
              <CardTitle>SEO 设置</CardTitle>
              <CardDescription>优化搜索引擎展示效果</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seo-description">SEO 描述</Label>
                <Textarea
                  id="seo-description"
                  placeholder="请输入搜索引擎描述摘要"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  className="min-h-[80px] resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  建议 150 字以内
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo-keywords">SEO 关键词</Label>
                <Input
                  id="seo-keywords"
                  placeholder="多个关键词用英文逗号分隔"
                  value={seoKeywords}
                  onChange={(e) => setSeoKeywords(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
