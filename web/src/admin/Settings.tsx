/**
 * 站点设置页面
 * 包含站点基本信息、评论设置和 SEO 默认配置
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * 站点设置页面
 * 管理站点基本信息、评论策略和全局 SEO 默认值
 */
export default function Settings() {
  /** 站点名称 */
  const [siteName, setSiteName] = useState("我的博客")
  /** 站点描述 */
  const [siteDescription, setSiteDescription] = useState("一个现代化的技术博客")
  /** 站点 Logo URL */
  const [siteLogo, setSiteLogo] = useState("")

  /** 评论审核策略 */
  const [commentPolicy, setCommentPolicy] = useState("manual")
  /** 是否允许匿名评论 */
  const [allowAnonymous, setAllowAnonymous] = useState(false)

  /** 全局默认 SEO 标题后缀 */
  const [seoTitleSuffix, setSeoTitleSuffix] = useState(" | 我的博客")
  /** 全局默认 SEO 描述 */
  const [seoDefaultDescription, setSeoDefaultDescription] = useState("")
  /** 全局默认 SEO 关键词 */
  const [seoDefaultKeywords, setSeoDefaultKeywords] = useState("")

  /**
   * 保存所有设置
   * 后续对接 API 时实现实际保存逻辑
   */
  function handleSave() {
    console.log("保存设置", {
      siteName,
      siteDescription,
      siteLogo,
      commentPolicy,
      allowAnonymous,
      seoTitleSuffix,
      seoDefaultDescription,
      seoDefaultKeywords,
    })
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">站点设置</h1>
          <p className="text-muted-foreground">配置站点基本信息和功能选项</p>
        </div>
        <Button onClick={handleSave}>保存设置</Button>
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
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="请输入站点名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-description">站点描述</Label>
              <Textarea
                id="site-description"
                value={siteDescription}
                onChange={(e) => setSiteDescription(e.target.value)}
                placeholder="请输入站点描述"
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-logo">站点 Logo</Label>
              {/* Logo 上传占位区域 */}
              <div className="flex h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                <div className="text-center">
                  <p className="text-xl">🖼️</p>
                  <p className="mt-1 text-xs">点击上传 Logo</p>
                </div>
              </div>
              {siteLogo && (
                <p className="text-xs text-muted-foreground">当前: {siteLogo}</p>
              )}
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
              <Select value={commentPolicy} onValueChange={setCommentPolicy}>
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
                checked={allowAnonymous}
                onChange={(e) => setAllowAnonymous(e.target.checked)}
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
                value={seoTitleSuffix}
                onChange={(e) => setSeoTitleSuffix(e.target.value)}
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
                value={seoDefaultDescription}
                onChange={(e) => setSeoDefaultDescription(e.target.value)}
                placeholder="当页面没有单独设置描述时使用的默认内容"
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seo-default-keywords">默认关键词</Label>
              <Input
                id="seo-default-keywords"
                value={seoDefaultKeywords}
                onChange={(e) => setSeoDefaultKeywords(e.target.value)}
                placeholder="多个关键词用英文逗号分隔"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
