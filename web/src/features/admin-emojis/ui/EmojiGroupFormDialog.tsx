import type { EmojiGroup } from "@entities/emoji/model/types";
import { useCreateEmojiGroup, useUpdateEmojiGroup } from "@features/admin-emojis/api/mutations";
import { type EmojiGroupForm, emojiGroupSchema } from "@features/admin-emojis/model/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@shared/ui/base/select";
import { Switch } from "@shared/ui/base/switch";
import { Modal } from "@shared/ui/modal";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

interface EmojiGroupFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingGroup: EmojiGroup | null;
    groupCount: number;
}

/**
 * EmojiGroupFormDialog - 创建/编辑表情分组
 *
 * 使用 React Hook Form + Zod 进行表单验证。
 * 打开时按 editingGroup 初始化表单，null 为创建态。
 */
export function EmojiGroupFormDialog({
    open,
    onOpenChange,
    editingGroup,
    groupCount,
}: EmojiGroupFormDialogProps) {
    const createGroup = useCreateEmojiGroup();
    const updateGroup = useUpdateEmojiGroup();

    const {
        register,
        handleSubmit,
        control,
        watch,
        reset,
        setValue,
        formState: { errors },
    } = useForm<EmojiGroupForm>({
        resolver: zodResolver(emojiGroupSchema),
        defaultValues: {
            name: "",
            source: "custom",
            cover_url: "",
            sort_order: 0,
            is_enabled: true,
        },
    });

    const isEnabled = watch("is_enabled");

    useEffect(() => {
        if (!open) return;
        if (editingGroup) {
            reset({
                name: editingGroup.name,
                source: editingGroup.source,
                cover_url: editingGroup.cover_url ?? "",
                sort_order: editingGroup.sort_order,
                is_enabled: editingGroup.is_enabled,
            });
        } else {
            reset({
                name: "",
                source: "custom",
                cover_url: "",
                sort_order: groupCount,
                is_enabled: true,
            });
        }
    }, [open, editingGroup, groupCount, reset]);

    const onSubmit = (data: EmojiGroupForm) => {
        const body = {
            name: data.name.trim(),
            source: data.source,
            cover_url: data.cover_url?.trim() || undefined,
            sort_order: data.sort_order,
            is_enabled: data.is_enabled,
        };

        if (editingGroup) {
            updateGroup.mutate(
                { id: editingGroup.id, name: editingGroup.name, body },
                {
                    onSuccess: () => {
                        toast.success("分组已更新");
                        onOpenChange(false);
                    },
                    onError: (err) => toast.error(err.message),
                },
            );
        } else {
            createGroup.mutate(body, {
                onSuccess: () => {
                    toast.success("分组已创建");
                    onOpenChange(false);
                },
                onError: (err) => toast.error(err.message),
            });
        }
    };

    const submitting = createGroup.isPending || updateGroup.isPending;

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={editingGroup ? "编辑表情分组" : "创建表情分组"}
            size="md"
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="w-full sm:w-auto"
                        disabled={submitting}
                    >
                        取消
                    </Button>
                    <Button
                        type="submit"
                        form="group-form"
                        disabled={submitting}
                        className="w-full sm:w-auto"
                    >
                        {submitting && <Loader2 className="mr-1 size-4 animate-spin" />}
                        {editingGroup ? "更新" : "创建"}
                    </Button>
                </>
            }
        >
            <form id="group-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="group-name">
                        名称 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="group-name"
                        placeholder="如：经典表情"
                        disabled={submitting}
                        aria-invalid={!!errors.name}
                        {...register("name")}
                    />
                    {errors.name && (
                        <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="group-source">来源</Label>
                    <Controller
                        control={control}
                        name="source"
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger
                                    id="group-source"
                                    className="w-full"
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <SelectValue placeholder="选择来源" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="system">系统</SelectItem>
                                    <SelectItem value="bilibili">B站</SelectItem>
                                    <SelectItem value="custom">自定义</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="group-cover">封面图 URL</Label>
                    <Input
                        id="group-cover"
                        placeholder="如：https://example.com/cover.png"
                        disabled={submitting}
                        {...register("cover_url")}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="group-sort">排序权重</Label>
                    <Input
                        id="group-sort"
                        type="number"
                        min={0}
                        placeholder="数字越小越靠前"
                        disabled={submitting}
                        {...register("sort_order", { valueAsNumber: true })}
                    />
                    {errors.sort_order && (
                        <p className="text-sm text-destructive">{errors.sort_order.message}</p>
                    )}
                </div>

                <div className="flex items-center justify-between">
                    <Label htmlFor="group-enabled" className="cursor-pointer">
                        启用状态
                    </Label>
                    <Switch
                        id="group-enabled"
                        checked={isEnabled}
                        disabled={submitting}
                        onCheckedChange={(checked) => setValue("is_enabled", checked)}
                    />
                </div>
            </form>
        </Modal>
    );
}
