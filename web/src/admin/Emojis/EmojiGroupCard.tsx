import type { EmojiGroupAdmin } from "@/hooks/useEmojisAdmin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, Smile, Tag } from "lucide-react";

/** 来源标签的颜色映射 */
const sourceColors: Record<string, string> = {
  system: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  bilibili: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  custom: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

/** 来源标签的中文映射 */
const sourceLabels: Record<string, string> = {
  system: "系统",
  bilibili: "B站",
  custom: "自定义",
};

interface EmojiGroupCardProps {
  group: EmojiGroupAdmin;
  togglingGroupId: number | null;
  onToggle: (group: EmojiGroupAdmin) => void;
  onEdit: (group: EmojiGroupAdmin) => void;
  onDelete: (id: number, name: string) => void;
  onManageEmojis: (groupId: number) => void;
}

export function EmojiGroupCard({
  group,
  togglingGroupId,
  onToggle,
  onEdit,
  onDelete,
  onManageEmojis,
}: EmojiGroupCardProps) {
  const sourceColor = sourceColors[group.source] || sourceColors.custom;
  const sourceLabel = sourceLabels[group.source] || group.source;

  return (
    <Card className={group.isEnabled ? "" : "opacity-60"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{group.name}</CardTitle>
            <Badge variant="outline" className={`text-xs ${sourceColor}`}>
              <Tag className="mr-0.5 size-3" />
              {sourceLabel}
            </Badge>
          </div>
          <Switch
            checked={group.isEnabled}
            onCheckedChange={() => onToggle(group)}
            loading={togglingGroupId === group.id}
            disabled={togglingGroupId === group.id}
          />
        </div>
        <CardDescription className="text-xs">
          ID: {group.id} | 排序: {group.sortOrder}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex gap-2">
          <Badge variant="outline">表情组</Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onManageEmojis(group.id)}
          >
            <Smile className="mr-1 size-3.5" />
            管理表情
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onEdit(group)}>
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
  );
}