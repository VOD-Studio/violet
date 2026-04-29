/**
 * 站点设置页面
 * 从 API 获取和保存站点设置，包含站点信息、评论设置和 SEO 配置
 * API 不存在时使用默认值
 */

import { useState, useEffect } from "react"
import { useSiteSettings, useSaveSettings } from "@/hooks/useAdmin"
import type { SiteSettings as SiteSettingsType } from "@/hooks/useAdmin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
 * 管理站点基本信息、评论策略和全局 SEO 默认值
 */
export default function Settings() {
  const { data: settings, isLoading, error, refetch } = useSiteSettings()
  const saveMutation = useSaveSettings()
  const { toast } = useToast()

  /* 表单状态 */
  const [form, setForm] = useState<Partial<SiteSettingsType>>({})

  /* 从 API 数据初始化表单 */
  useEffect(() => {
    if (settings) {
      setForm(settings)
    }
  }, [settings])

  /**
   * 更新表单字段
   */
  function updateField(key: keyof SiteSettingsType, value: string | boolean) {
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
                value={form.siteName ?? ""}
                onChange={(e) => updateField("siteName", e.target.value)}
                placeholder="请输入站点名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-description">站点描述</Label>
              <Textarea
                id="site-description"
                value={form.siteDescription ?? ""}
                onChange={(e) => updateField("siteDescription", e.target.value)}
                placeholder="请输入站点描述"
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-logo">站点 Logo URL</Label>
              <Input
                id="site-logo"
                value={form.siteLogo ?? ""}
                onChange={(e) => updateField("siteLogo", e.target.value)}
                placeholder="请输入 Logo 图片地址"
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
            <div className="space-y-2">
              <Label>评论审核策略</Label>
              <Select
                value={form.commentPolicy ?? "manual"}
                onValueChange={(value) => updateField("commentPolicy", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">手动审核</SelectItem>
                  <SelectItem value="auto">自动通过</SelectItem>
                  <SelectItem value="first">首条评论需审核</SelectItem>
                  <SelectItem value="disabled">关闭评论</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                手动审核：所有评论需要管理员批准后才会显示
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allow-anonymous"
                checked={form.allowAnonymous ?? false}
                onChange={(e) => updateField("allowAnonymous", e.target.checked)}
                className="size-4 rounded border"
              />
              <Label htmlFor="allow-anonymous" className="cursor-pointer">
                允许匿名评论
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* SEO 默认设置 */}
        <Card>
          <CardHeader>
            <CardTitle>SEO 默认设置</CardTitle>
            <CardDescription>配置全局 SEO 默认值</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="seo-title-suffix">标题后缀</Label>
              <Input
                id="seo-title-suffix"
                value={form.seoTitleSuffix ?? ""}
                onChange={(e) => updateField("seoTitleSuffix", e.target.value)}
                placeholder="例如: | 我的博客"
              />
              <p className="text-xs text-muted-foreground">
                会自动追加到每个页面标题后面
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seo-default-description">默认描述</Label>
              <Textarea
                id="seo-default-description"
                value={form.seoDefaultDescription ?? ""}
                onChange={(e) => updateField("seoDefaultDescription", e.target.value)}
                placeholder="当页面没有单独设置描述时使用的默认内容"
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seo-default-keywords">默认关键词</Label>
              <Input
                id="seo-default-keywords"
                value={form.seoDefaultKeywords ?? ""}
                onChange={(e) => updateField("seoDefaultKeywords", e.target.value)}
                placeholder="多个关键词用英文逗号分隔"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
