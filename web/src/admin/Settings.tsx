/**
 * 站点设置页面
 * 从 API 获取和保存站点设置，包含站点信息、评论设置和 GitHub 配置
 */

import { useState, useEffect } from "react"
import { useSiteSettings, useSaveSettings } from "@/hooks/useAdmin"
import type { SiteSettings as SiteSettingsType } from "@/hooks/useAdmin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorFallback } from "@/components/shared/ErrorFallback"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/shared/Toast"

/**
 * 设置页面骨架屏
 */
function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/**
 * 站点设置页面
 * 管理站点基本信息、评论策略和 GitHub 配置
 */
export default function Settings() {
  const { data: settings, isLoading, error, refetch } = useSiteSettings()
  const saveMutation = useSaveSettings()
  const { toast } = useToast()

  /** 表单状态 */
  const [form, setForm] = useState<Partial<SiteSettingsType>>({})

  /** 从 API 数据初始化表单 */
  useEffect(() => {
    if (settings) {
      setForm(settings)
    }
  }, [settings])

  /**
   * 更新表单字段
   */
  function updateField(key: keyof SiteSettingsType, value: string | boolean | number) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  /**
   * 保存设置
   */
  async function handleSave() {
    try {
      await saveMutation.mutateAsync(form)
      toast("设置已保存", "success")
    } catch {
      toast("保存失败，请重试", "error")
    }
  }

  /* 加载态 */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">站点设置</h1>
            <p className="text-muted-foreground">加载中...</p>
          </div>
        </div>
        <SettingsSkeleton />
      </div>
    )
  }

  /* 错误状态 */
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">站点设置</h1>
        <ErrorFallback error={error.message} onRetry={refetch} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">站点设置</h1>
          <p className="text-muted-foreground">配置站点基本信息和功能选项</p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "保存中..." : "保存设置"}
        </Button>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* 站点基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle>站点信息</CardTitle>
            <CardDescription>配置站点基本展示信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site-name">站点名称</Label>
              <Input
                id="site-name"
                value={form.site_name ?? ""}
                onChange={(e) => updateField("site_name", e.target.value)}
                placeholder="请输入站点名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-description">站点描述</Label>
              <Textarea
                id="site-description"
                value={form.site_description ?? ""}
                onChange={(e) => updateField("site_description", e.target.value)}
                placeholder="请输入站点描述"
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-url">站点 URL</Label>
              <Input
                id="site-url"
                value={form.site_url ?? ""}
                onChange={(e) => updateField("site_url", e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">管理员邮箱</Label>
              <Input
                id="admin-email"
                type="email"
                value={form.admin_email ?? ""}
                onChange={(e) => updateField("admin_email", e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* 评论设置 */}
        <Card>
          <CardHeader>
            <CardTitle>评论设置</CardTitle>
            <CardDescription>配置评论审核和展示策略</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="comments-enabled"
                checked={form.comments_enabled ?? true}
                onChange={(e) => updateField("comments_enabled", e.target.checked)}
                className="size-4 rounded border"
              />
              <Label htmlFor="comments-enabled" className="cursor-pointer">
                启用评论功能
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="comments-moderation"
                checked={form.comments_moderation ?? true}
                onChange={(e) => updateField("comments_moderation", e.target.checked)}
                className="size-4 rounded border"
              />
              <Label htmlFor="comments-moderation" className="cursor-pointer">
                评论需要审核
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="posts-per-page">每页文章数</Label>
              <Input
                id="posts-per-page"
                type="number"
                min="1"
                max="50"
                value={form.posts_per_page ?? 10}
                onChange={(e) => updateField("posts_per_page", parseInt(e.target.value) || 10)}
              />
            </div>
          </CardContent>
        </Card>

        {/* GitHub 配置 */}
        <Card>
          <CardHeader>
            <CardTitle>GitHub 配置</CardTitle>
            <CardDescription>配置 GitHub 用户名，用于展示贡献热力图和置顶仓库</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="github-username">GitHub 用户名</Label>
              <Input
                id="github-username"
                value={form.github_username ?? ""}
                onChange={(e) => updateField("github_username", e.target.value)}
                placeholder="请输入 GitHub 用户名"
              />
              <p className="text-xs text-muted-foreground">
                设置后将在关于页展示 GitHub 贡献热力图和置顶仓库
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 页脚设置 */}
        <Card>
          <CardHeader>
            <CardTitle>页脚设置</CardTitle>
            <CardDescription>配置页面底部展示内容</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="footer-text">页脚文字</Label>
              <Input
                id="footer-text"
                value={form.footer_text ?? ""}
                onChange={(e) => updateField("footer_text", e.target.value)}
                placeholder="© 2026 My Blog"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
