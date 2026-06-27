import { useUpdateEmojiGroup } from "@features/emojis/api/mutations";
import type { EmojiGroup } from "@features/emojis/model/types";
import { cn } from "@shared/lib/utils";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@shared/ui/card";
import { Switch } from "@shared/ui/switch";
import { Hash, Pencil, Smile, SortAsc, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";

/** 来源标签的颜色映射 */
const SOURCE_COLORS: Record<string, string> = {
    system: "bg-gradient-to-r from-blue-500/10 to-blue-600/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    bilibili:
        "bg-gradient-to-r from-pink-500/10 to-pink-600/10 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800",
    custom: "bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
};

/** 来源标签的中文映射 */
const SOURCE_LABELS: Record<string, string> = {
    system: "系统",
    bilibili: "B站",
    custom: "自定义",
};

interface EmojiGroupCardProps {
    group: EmojiGroup;
    onEdit: (group: EmojiGroup) => void;
    onDelete: (group: EmojiGroup) => void;
    onManageEmojis: (groupId: number) => void;
}

/**
 * EmojiGroupCard - 表情分组卡片
 *
 * 启用态用渐变边框与阴影，禁用态虚线 ring 整体灰化。
 * 内部用 useUpdateEmojiGroup 切换启用状态，编辑/删除/管理表情走回调交父层。
 */
export function EmojiGroupCard({ group, onEdit, onDelete, onManageEmojis }: EmojiGroupCardProps) {
    const updateGroup = useUpdateEmojiGroup(group.id, group.name);
    const sourceColor = SOURCE_COLORS[group.source] ?? SOURCE_COLORS.custom;
    const sourceLabel = SOURCE_LABELS[group.source] ?? group.source;
    const isDisabled = !group.is_enabled;
    const isToggling = updateGroup.isPending;

    const handleToggle = () => {
        updateGroup.mutate(
            { is_enabled: !group.is_enabled },
            {
                onSuccess: () => toast.success(group.is_enabled ? "已禁用" : "已启用"),
                onError: (err) => toast.error(err.message),
            },
        );
    };

    return (
        <Card
            className={cn(
                "relative overflow-hidden transition-all duration-300",
                !isDisabled && [
                    "before:absolute before:inset-0 before:rounded-xl before:p-[1px]",
                    "before:bg-gradient-to-br before:from-primary/40 before:via-primary/20 before:to-transparent",
                    "before:-z-10",
                    "shadow-md shadow-primary/5 hover:shadow-lg hover:shadow-primary/10",
                ],
                isDisabled && [
                    "bg-muted/30",
                    "ring-1 ring-dashed ring-muted-foreground/30",
                    "[&_*]:text-muted-foreground/60",
                ],
            )}
        >
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-2">
                        <CardTitle
                            className={cn(
                                "truncate text-lg font-semibold",
                                isDisabled && "text-muted-foreground/70",
                            )}
                        >
                            {group.name}
                        </CardTitle>
                        <Badge
                            variant="outline"
                            className={cn(
                                "w-fit gap-1 border px-2 py-0.5 text-xs font-medium",
                                sourceColor,
                                isDisabled && "opacity-50",
                            )}
                        >
                            <Tag className="size-3" />
                            {sourceLabel}
                        </Badge>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <Switch
                            checked={group.is_enabled}
                            onCheckedChange={handleToggle}
                            disabled={isToggling}
                            className={cn(
                                isDisabled && "data-[state=unchecked]:bg-muted-foreground/30",
                            )}
                        />
                        <span
                            className={cn(
                                "text-xs font-medium tabular-nums",
                                group.is_enabled ? "text-primary" : "text-muted-foreground/50",
                            )}
                        >
                            {group.is_enabled ? "已启用" : "已禁用"}
                        </span>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pb-3 pt-1">
                <div className="flex items-center gap-4 text-sm">
                    <div
                        className={cn(
                            "flex items-center gap-1.5 text-muted-foreground",
                            isDisabled && "opacity-50",
                        )}
                    >
                        <Hash className="size-3.5" />
                        <span className="tabular-nums">{group.id}</span>
                    </div>
                    <div
                        className={cn(
                            "flex items-center gap-1.5 text-muted-foreground",
                            isDisabled && "opacity-50",
                        )}
                    >
                        <SortAsc className="size-3.5" />
                        <span className="tabular-nums">{group.sort_order}</span>
                    </div>
                </div>
            </CardContent>

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
                        onClick={() => onDelete(group)}
                        title="删除"
                        className={cn(
                            "hover:bg-destructive/10 hover:text-destructive",
                            isDisabled && "hover:bg-transparent",
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
