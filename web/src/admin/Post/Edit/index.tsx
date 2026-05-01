// 文章编辑页面
// 支持新建和编辑文章，使用 react-hook-form 管理表单状态

import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useForm, Controller } from "react-hook-form"
import { api } from "@/lib/api"
import { useAdminTags, useSavePost } from "@/hooks/useAdmin"
import type { ApiPost, ApiTag } from "@/hooks/useAdmin"
import { RichTextEditor } from "@/components/editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CoverImageUpload } from "./CoverImageUpload"
import { TagSelector } from "./TagSelector"
import { SeoSettings } from "./SeoSettings"
import { MediaPicker, type MediaItem } from "./MediaPicker"
import { BackToTop } from "@/components/shared/BackToTop"

/** 表单字段类型 */
interface PostFormValues {
  title: string
  slug: string
  contentMarkdown: string
  excerpt: string
  coverImage: string
  tagIds: number[]
  seoDescription: string
  seoKeywords: string
}

/**
 * 文章编辑页面
 */
export default function PostEdit() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const { data: availableTags = [], isLoading: tagsLoading } = useAdminTags()
  const saveMutation = useSavePost()
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)

  const {
    register,
    control,
    setValue,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<PostFormValues>({
    defaultValues: {
      title: "",
      slug: "",
      contentMarkdown: "",
      excerpt: "",
      coverImage: "",
      tagIds: [],
      seoDescription: "",
      seoKeywords: "",
    },
  })

  const coverImage = watch("coverImage")
  const tagIds = watch("tagIds")
  const seoDescription = watch("seoDescription")
  const seoKeywords = watch("seoKeywords")

  /* 编辑模式下加载文章数据 */
  useEffect(() => {
    if (!id) return

    async function loadPost() {
      try {
        const post = await api.get<ApiPost>(`/posts/id/${id}`)
        setValue("title", post.title)
        setValue("slug", post.slug)
        setValue("contentMarkdown", post.contentMarkdown ?? "")
        setValue("excerpt", post.excerpt ?? "")
        setValue("coverImage", post.coverImage ?? "")
        setValue("tagIds", post.tags?.map((t: ApiTag) => t.id) ?? [])
        setValue("seoDescription", post.seoDescription ?? "")
        setValue("seoKeywords", post.seoKeywords ?? "")
      } catch (err) {
        console.error("加载文章失败:", err)
      }
    }

    loadPost()
  }, [id, setValue])

  /* 从素材库选择图片 */
  function handleMediaSelect(media: MediaItem) {
    setValue("coverImage", media.path)
  }

  /* 提交表单 */
  async function onSubmit(data: PostFormValues, status: "draft" | "published") {
    try {
      await saveMutation.mutateAsync({
        data: {
          title: data.title,
          slug: data.slug || undefined,
          contentMarkdown: data.contentMarkdown,
          excerpt: data.excerpt || undefined,
          coverImage: data.coverImage || undefined,
          status,
          tagIds: data.tagIds.length > 0 ? data.tagIds : undefined,
          seoDescription: data.seoDescription || undefined,
          seoKeywords: data.seoKeywords || undefined,
        },
        id: isEditing ? id : undefined,
      })
      navigate("/admin/posts")
    } catch {
      /* 错误由 saveMutation 处理 */
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? "编辑文章" : "新建文章"}</h1>
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
            onClick={handleSubmit((data) => onSubmit(data, "draft"))}
          >
            {saveMutation.isPending ? "保存中..." : "保存草稿"}
          </Button>
          <Button
            disabled={saveMutation.isPending}
            onClick={handleSubmit((data) => onSubmit(data, "published"))}
          >
            {saveMutation.isPending ? "发布中..." : "发布"}
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {saveMutation.error && (
        <p className="text-sm text-destructive">{saveMutation.error.message}</p>
      )}

      <form className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* 左侧主编辑区 */}
        <div className="space-y-6">
          {/* 标题 */}
          <div className="space-y-2">
            <Label htmlFor="title">文章标题</Label>
            <Input
              id="title"
              placeholder="请输入文章标题"
              className={`text-lg ${errors.title ? "border-destructive" : ""}`}
              {...register("title", {
                required: "标题不能为空",
                minLength: { value: 1, message: "标题至少 1 个字符" },
              })}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug（可选）</Label>
            <Input
              id="slug"
              placeholder="自定义短链接，如：my-post，不填则自动生成"
              {...register("slug")}
            />
            <p className="text-xs text-muted-foreground">
              留空则根据标题自动生成，建议使用简短英文便于分享
            </p>
          </div>

          {/* 摘要 */}
          <div className="space-y-2">
            <Label htmlFor="excerpt">文章摘要</Label>
            <Textarea
              id="excerpt"
              placeholder="请输入文章摘要（可选）"
              className="min-h-[80px] resize-y"
              {...register("excerpt")}
            />
          </div>

          {/* 内容 */}
          <div className="space-y-2">
            <Label>文章内容</Label>
            <Controller
              name="contentMarkdown"
              control={control}
              rules={{ required: "内容不能为空" }}
              render={({ field, fieldState }) => (
                <>
                  <RichTextEditor
                    content={field.value}
                    onChange={field.onChange}
                    placeholder="请输入文章内容"
                  />
                  {fieldState.error && (
                    <p className="text-sm text-destructive">{fieldState.error.message}</p>
                  )}
                </>
              )}
            />
          </div>
        </div>

        {/* 右侧设置面板 */}
        <div className="space-y-6">
          {/* 标签选择 */}
          <TagSelector
            tags={availableTags}
            selectedIds={tagIds ?? []}
            onChange={(ids) => setValue("tagIds", ids)}
            loading={tagsLoading}
          />

          {/* 封面图 */}
          <Card>
            <CardHeader>
              <CardTitle>封面图</CardTitle>
              <CardDescription>上传文章封面图片</CardDescription>
            </CardHeader>
            <CardContent>
              <CoverImageUpload
                value={coverImage}
                onChange={(url) => setValue("coverImage", url)}
                disabled={saveMutation.isPending}
                onOpenMediaPicker={() => setMediaPickerOpen(true)}
              />
            </CardContent>
          </Card>

          {/* SEO 设置 */}
          <SeoSettings
            seoDescription={seoDescription}
            seoKeywords={seoKeywords}
            onDescriptionChange={(val) => setValue("seoDescription", val)}
            onKeywordsChange={(val) => setValue("seoKeywords", val)}
          />
        </div>
      </form>

      {/* 素材库选择器 */}
      <MediaPicker
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        mimeTypeFilter="image"
      />

      {/* 回到顶部 */}
      <BackToTop threshold={300} variant="chevron" />
    </div>
  )
}