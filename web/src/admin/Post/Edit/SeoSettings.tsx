// SEO 设置组件

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface SeoSettingsProps {
  /** SEO 描述 */
  seoDescription: string
  /** SEO 关键词 */
  seoKeywords: string
  /** SEO 描述变化回调 */
  onDescriptionChange: (value: string) => void
  /** SEO 关键词变化回调 */
  onKeywordsChange: (value: string) => void
}

/**
 * SEO 设置组件
 */
export function SeoSettings({
  seoDescription,
  seoKeywords,
  onDescriptionChange,
  onKeywordsChange,
}: SeoSettingsProps) {
  return (
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
            value={seoDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">建议 150 字以内</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="seoKeywords">SEO 关键词</Label>
          <Input
            id="seoKeywords"
            placeholder="多个关键词用英文逗号分隔"
            value={seoKeywords}
            onChange={(e) => onKeywordsChange(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  )
}