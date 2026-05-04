import type { EmojiGroupAdmin } from "@/hooks/useEmojisAdmin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, Smile, Tag, Hash, SortAsc } from "lucide-react";
import { cn } from "@/lib/utils";

/** 来源标签的颜色映射 */
const sourceColors: Record<string, string> = {
  system:
    "bg-gradient-to-r from-blue-500/10 to-blue-600/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  bilibili:
    "bg-gradient-to-r from-pink-500/10 to-pink-600/10 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800",
  custom:
    "bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
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
  const isDisabled = !group.is_enabled;
  const isToggling = togglingGroupId === group.id;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        // 启用状态：渐变边框效果
        !isDisabled && [
          "before:absolute before:inset-0 before:rounded-xl before:p-[1px]",
          "before:bg-gradient-to-br before:from-primary/40 before:via-primary/20 before:to-transparent",
          "before:-z-10",
          "shadow-md shadow-primary/5 hover:shadow-lg hover:shadow-primary/10",
        ],
        // 禁用状态：更明显的视觉反馈
        isDisabled && [
          "bg-muted/30",
          "ring-1 ring-dashed ring-muted-foreground/30",
          "[&_*]:text-muted-foreground/60",
        ]
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-2">
            <CardTitle
              className={cn(
                "truncate text-lg font-semibold",
                isDisabled && "text-muted-foreground/70"
              )}
            >
              {group.name}
            </CardTitle>
            <Badge
              variant="outline"
              className={cn(
                "w-fit gap-1 border px-2 py-0.5 text-xs font-medium",
                sourceColor,
                isDisabled && "opacity-50"
              )}
            >
              <Tag className="size-3" />
              {sourceLabel}
            </Badge>
          </div>
          {/* 状态开关 */}
          <div className="flex flex-col items-end gap-1">
            <Switch
              checked={group.is_enabled}
              onCheckedChange={() => onToggle(group)}
              loading={isToggling}
              disabled={isToggling}
              className={cn(
                isDisabled && "data-[state=unchecked]:bg-muted-foreground/30"
              )}
            />
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                group.is_enabled ? "text-primary" : "text-muted-foreground/50"
              )}
            >
              {group.is_enabled ? "已启用" : "已禁用"}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 pt-1">
        {/* 统计信息 */}
        <div className="flex items-center gap-4 text-sm">
          <div
            className={cn(
              "flex items-center gap-1.5 text-muted-foreground",
              isDisabled && "opacity-50"
            )}
          >
            <Hash className="size-3.5" />
            <span className="tabular-nums">{group.id}</span>
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 text-muted-foreground",
              isDisabled && "opacity-50"
            )}
          >
            <SortAsc className="size-3.5" />
            <span className="tabular-nums">{group.sort_order}</span>
          </div>
        </div>
      </CardContent>

      {/* 操作按钮组 */}
      <CardFooter className="gap-2 border-t/50 bg-muted/20 pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onManageEmojis(group.id)}
          className="flex-1 gap-1.5"
          disabled={isDisabled}
        >
          <Smile className="size-3.5" />
          管理表情
        </Button>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(group)}
            title="编辑"
            disabled={isDisabled}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(group.id, group.name)}
            title="删除"
            className={cn(
              "hover:bg-destructive/10 hover:text-destructive",
              isDisabled && "hover:bg-transparent"
            )}
            disabled={isDisabled}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
