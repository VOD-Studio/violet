// 标签选择组件

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ApiTag } from "@/hooks/useAdmin";

interface TagSelectorProps {
  /** 可选标签列表 */
  tags: ApiTag[];
  /** 已选中的标签 ID */
  selectedIds: number[];
  /** 标签选中状态变化回调 */
  onChange: (tagIds: number[]) => void;
  /** 是否加载中 */
  loading?: boolean;
}

/**
 * 标签选择组件
 */
export function TagSelector({
  tags,
  selectedIds,
  onChange,
  loading,
}: TagSelectorProps) {
  function toggleTag(tagId: number) {
    if (selectedIds.includes(tagId)) {
      onChange(selectedIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedIds, tagId]);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>文章标签</CardTitle>
        <CardDescription>选择文章相关标签</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">加载标签中...</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant={selectedIds.includes(tag.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </Badge>
            ))}
            {tags.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无可用标签</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
