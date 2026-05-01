/**
 * 文章编辑页面
 * 支持新建和编辑文章，使用 react-hook-form 管理表单状态
 */

import { useEffect } from "react"
import { useNavigate, useParams } from "react-router"
import { useForm, Controller } from "react-hook-form"
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

/** 表单字段类型 */
interface PostFormValues {
  title: string
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

  /* 编辑模式下加载文章数据 */
  useEffect(() => {
    if (!id) return

    async function loadPost() {
      try {
        const post = await api.get<ApiPost>(`/posts/id/${id}`)
        setValue("title", post.title)
        setValue("contentMarkdown", post.contentMarkdown ?? "")
        setValue("excerpt", post.excerpt ?? "")
        setValue("coverImage", post.coverImage ?? "")
        setValue("tagIds", post.tags?.map((t) => t.id) ?? [])
        setValue("seoDescription", post.seoDescription ?? "")
        setValue("seoKeywords", post.seoKeywords ?? "")
      } catch (err) {
        console.error("加载文章失败:", err)
      }
    }

    loadPost()
  }, [id, setValue])

  /**
   * 处理封面图上传
   */
  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const result: UploadResult = await uploadFile(file)
      setValue("coverImage", result.url)
    } catch (err) {
      console.error("封面图上传失败:", err)
    }
  }

  /**
   * 清除封面图
   */
  function clearCover() {
    setValue("coverImage", "")
  }

  /**
   * 切换标签选中状态
   */
  function toggleTag(tagId: number) {
    const current = tagIds ?? []
    setValue(
      "tagIds",
      current.includes(tagId) ? current.filter((t) => t !== tagId) : [...current, tagId]
    )
  }

  /**
   * 提交表单
   */
  async function onSubmit(data: PostFormValues, status: "draft" | "published") {
    try {
      await saveMutation.mutateAsync({
        data: {
          title: data.title,
          contentMarkdown: data.contentMarkdown,
          excerpt: data.excerpt || undefined,
          coverImage: data.coverImage || undefined,
          status,
          tagIds: data.tagIds.length > 0 ? data.tagIds : undefined,
          seoDescription: data.seoDescription || undefined,
          seoKeywords: data.seoKeywords || undefined,
        },
        id: isEditing ? Number(id) : undefined,
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
              {...register("title", { required: "标题不能为空", minLength: { value: 1, message: "标题至少 1 个字符" } })}
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
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
                      variant={tagIds?.includes(tag.id) ? "default" : "outline"}
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

          {/* 封面图 */}
          <Card>
            <CardHeader>
              <CardTitle>封面图</CardTitle>
              <CardDescription>上传文章封面图片</CardDescription>
            </CardHeader>
            <CardContent>
              {coverImage ? (
                <div className="relative aspect-video overflow-hidden rounded-lg">
                  <img src={coverImage} alt="封面图" className="h-full w-full object-cover" />
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
                    disabled={saveMutation.isPending}
                  />
                  <div className="text-center">
                    {saveMutation.isPending ? (
                      <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                    ) : (
                      <Camera className="mx-auto h-8 w-8" />
                    )}
                    <p className="mt-1 text-sm">
                      {saveMutation.isPending ? "上传中..." : "点击上传封面图"}
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
                <Label htmlFor="seoDescription">SEO 描述</Label>
                <Textarea
                  id="seoDescription"
                  placeholder="请输入搜索引擎描述摘要"
                  className="min-h-[80px] resize-y"
                  {...register("seoDescription")}
                />
                <p className="text-xs text-muted-foreground">建议 150 字以内</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoKeywords">SEO 关键词</Label>
                <Input
                  id="seoKeywords"
                  placeholder="多个关键词用英文逗号分隔"
                  {...register("seoKeywords")}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  )
}