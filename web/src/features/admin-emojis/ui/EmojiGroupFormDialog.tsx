import type { EmojiGroup } from "@entities/emoji/model/types";
import { useCreateEmojiGroup, useUpdateEmojiGroup } from "@features/admin-emojis/api/mutations";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
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
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface EmojiGroupFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingGroup: EmojiGroup | null;
    groupCount: number;
}

interface GroupFormState {
    name: string;
    source: string;
    sortOrder: number;
    isEnabled: boolean;
}

/**
 * EmojiGroupFormDialog - 创建/编辑表情分组
 *
 * 打开时按 editingGroup 初始化表单，null 为创建态。
 * 创建走 useCreateEmojiGroup，编辑走 useUpdateEmojiGroup，成功后 toast 并关闭。
 */
export function EmojiGroupFormDialog({
    open,
    onOpenChange,
    editingGroup,
    groupCount,
}: EmojiGroupFormDialogProps) {
    const createGroup = useCreateEmojiGroup();
    const updateGroup = useUpdateEmojiGroup();

    const [form, setForm] = useState<GroupFormState>({
        name: "",
        source: "custom",
        sortOrder: 0,
        isEnabled: true,
    });

    useEffect(() => {
        if (!open) return;
        if (editingGroup) {
            setForm({
                name: editingGroup.name,
                source: editingGroup.source,
                sortOrder: editingGroup.sort_order,
                isEnabled: editingGroup.is_enabled,
            });
        } else {
            setForm({ name: "", source: "custom", sortOrder: groupCount, isEnabled: true });
        }
    }, [open, editingGroup, groupCount]);

    const handleSubmit = () => {
        const name = form.name.trim();
        if (!name) {
            toast.error("请输入分组名称");
            return;
        }

        const body = {
            name,
            source: form.source,
            sort_order: form.sortOrder,
            is_enabled: form.isEnabled,
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
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="w-full sm:w-auto"
                    >
                        取消
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full sm:w-auto"
                    >
                        {submitting && <Loader2 className="mr-1 size-4 animate-spin" />}
                        {editingGroup ? "更新" : "创建"}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div>
                    <label htmlFor="group-name" className="text-sm font-medium">
                        名称
                    </label>
                    <Input
                        id="group-name"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="如：经典表情"
                        className="mt-1.5"
                    />
                </div>
                <div>
                    <label htmlFor="group-source" className="text-sm font-medium">
                        来源
                    </label>
                    <Select
                        value={form.source}
                        onValueChange={(value) => setForm((p) => ({ ...p, source: value }))}
                    >
                        <SelectTrigger
                            id="group-source"
                            className="mt-1.5 w-full"
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
                </div>
                <div>
                    <label htmlFor="group-sort" className="text-sm font-medium">
                        排序权重
                    </label>
                    <Input
                        id="group-sort"
                        type="number"
                        value={form.sortOrder}
                        onChange={(e) =>
                            setForm((p) => ({
                                ...p,
                                sortOrder: Number.parseInt(e.target.value, 10) || 0,
                            }))
                        }
                        placeholder="数字越小越靠前"
                        className="mt-1.5"
                    />
                </div>
                <div className="flex items-center justify-between">
                    <label htmlFor="group-enabled" className="text-sm font-medium">
                        启用状态
                    </label>
                    <Switch
                        id="group-enabled"
                        checked={form.isEnabled}
                        onCheckedChange={(checked) =>
                            setForm((p) => ({ ...p, isEnabled: checked }))
                        }
                    />
                </div>
            </div>
        </Modal>
    );
}
