/**
 * 文章编辑页面
 * 支持新建和编辑文章，包含标题、内容、标签、封面图、SEO 设置等功能
 */

import { useState } from "react"
import { useNavigate, useParams } from "react-router"
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

/** 可选标签列表 */
const availableTags = [
  "React", "TypeScript", "Tailwind", "Vite", "Node.js",
  "Next.js", "CSS", "JavaScript", "Docker", "Git",
]

/**
 * 文章编辑页面
 * 包含标题输入、内容编辑、标签选择、封面图上传占位和 SEO 设置
 */
export default function PostEdit() {
  const navigate = useNavigate()
  /** 从路由参数中获取文章 ID，新建时不存在 */
  const { id } = useParams()
  /** 是否为编辑模式 */
  const isEditing = Boolean(id)

  /** 文章标题 */
  const [title, setTitle] = useState("")
  /** 文章内容 */
  const [content, setContent] = useState("")
  /** 已选标签 */
  const [tags, setTags] = useState<string[]>([])
  /** SEO 描述 */
  const [seoDescription, setSeoDescription] = useState("")
  /** SEO 关键词 */
  const [seoKeywords, setSeoKeywords] = useState("")

  /**
   * 切换标签的选中状态
   * @param tag - 标签名称
   */
  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  /**
   * 保存文章为草稿
   * 后续对接 API 时实现实际保存逻辑
   */
  function handleSave() {
    console.log("保存草稿", { title, content, tags, seoDescription, seoKeywords })
    navigate("/admin/posts")
  }

  /**
   * 发布文章
   * 后续对接 API 时实现实际发布逻辑
   */
  function handlePublish() {
    console.log("发布文章", { title, content, tags, seoDescription, seoKeywords })
    navigate("/admin/posts")
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
          <Button variant="secondary" onClick={handleSave}>
            保存草稿
          </Button>
          <Button onClick={handlePublish}>发布</Button>
        </div>
      </div>

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

          {/* 内容编辑区域，后续替换为 Tiptap 富文本编辑器 */}
          <div className="space-y-2">
            <Label htmlFor="content">文章内容</Label>
            <Textarea
              id="content"
              placeholder="请输入文章内容（后续将集成 Tiptap 富文本编辑器）"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[400px] resize-y"
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
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={tags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 封面图上传 */}
          <Card>
            <CardHeader>
              <CardTitle>封面图</CardTitle>
              <CardDescription>上传文章封面图片</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                <div className="text-center">
                  <p className="text-2xl">📷</p>
                  <p className="mt-1 text-sm">点击上传封面图</p>
                </div>
              </div>
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
