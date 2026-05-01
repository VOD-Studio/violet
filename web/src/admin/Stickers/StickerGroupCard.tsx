import type { StickerGroup } from "@/hooks/useStickersAdmin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { getUploadUrl } from "@/lib/api"
import { Pencil, Trash2, Star, Image as ImageIcon } from "lucide-react"

interface StickerGroupCardProps {
  group: StickerGroup
  togglingGroupId: string | null
  onToggle: (group: StickerGroup) => void
  onEdit: (group: StickerGroup) => void
  onDelete: (id: string, name: string) => void
  onManageStickers: (groupId: string) => void
}

export function StickerGroupCard({
  group,
  togglingGroupId,
  onToggle,
  onEdit,
  onDelete,
  onManageStickers,
}: StickerGroupCardProps) {
  return (
    <Card className={group.is_active ? "" : "opacity-60"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {group.icon && (
              <img
                src={getUploadUrl(group.icon)}
                alt={group.name}
                className="h-6 w-6 rounded object-cover"
              />
            )}
            <CardTitle className="text-base">{group.name}</CardTitle>
            {group.is_hot && (
              <Badge variant="secondary" className="text-xs">
                <Star className="mr-0.5 size-3" />
                热门
              </Badge>
            )}
          </div>
          <Switch
            checked={group.is_active}
            onCheckedChange={() => onToggle(group)}
            loading={togglingGroupId === group.id}
            disabled={togglingGroupId === group.id}
          />
        </div>
        <CardDescription className="text-xs">
          {group.description || `slug: ${group.slug}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex gap-2">
          {(group.sticker_count ?? 0) > 0 ? (
            <Badge variant="outline">{group.sticker_count ?? 0} 个表情包</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">暂无表情包</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onManageStickers(group.id)}
          >
            <ImageIcon className="mr-1 size-3.5" />
            管理表情包
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(group)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(group.id, group.name)}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}