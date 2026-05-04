import { useState, useEffect } from "react";
import type {
  EmojiGroupAdmin,
  CreateEmojiGroupInput,
} from "@/hooks/useEmojisAdmin";
import {
  useCreateEmojiGroup,
  useUpdateEmojiGroup,
} from "@/hooks/useEmojisAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EmojiGroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGroup: EmojiGroupAdmin | null;
  groupCount: number;
}

export function EmojiGroupFormDialog({
  open,
  onOpenChange,
  editingGroup,
  groupCount,
}: EmojiGroupFormDialogProps) {
  const createGroup = useCreateEmojiGroup();
  const updateGroup = useUpdateEmojiGroup();

  const [form, setForm] = useState<CreateEmojiGroupInput>({
    name: "",
    source: "custom",
    sortOrder: 0,
    isEnabled: true,
  });

  // 当打开弹窗时，初始化表单
  useEffect(() => {
    if (open) {
      if (editingGroup) {
        setForm({
          name: editingGroup.name,
          source: editingGroup.source,
          sortOrder: editingGroup.sortOrder,
          isEnabled: editingGroup.isEnabled,
        });
      } else {
        setForm({
          name: "",
          source: "custom",
          sortOrder: groupCount,
          isEnabled: true,
        });
      }
    }
  }, [open, editingGroup, groupCount]);

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("请输入分组名称");
      return;
    }

    const data: CreateEmojiGroupInput = {
      name: form.name.trim(),
      source: form.source,
      sortOrder: form.sortOrder,
      isEnabled: form.isEnabled,
    };

    if (editingGroup) {
      updateGroup.mutate(
        { id: editingGroup.id, data },
        {
          onSuccess: () => {
            toast.success("分组已更新");
            onOpenChange(false);
          },
          onError: () => toast.error("更新失败"),
        },
      );
    } else {
      createGroup.mutate(data, {
        onSuccess: () => {
          toast.success("分组已创建");
          onOpenChange(false);
        },
        onError: () => toast.error("创建失败"),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingGroup ? "编辑表情分组" : "创建表情分组"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">名称</label>
            <Input
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="如：经典表情"
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="text-sm font-medium">来源</label>
            <Select
              value={form.source}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, source: value }))
              }
            >
              <SelectTrigger className="mt-1.5">
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
            <label className="text-sm font-medium">排序权重</label>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  sortOrder: parseInt(e.target.value) || 0,
                }))
              }
              placeholder="数字越小越靠前"
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">启用状态</label>
            <Switch
              checked={form.isEnabled}
              onCheckedChange={(checked: boolean) =>
                setForm((prev) => ({ ...prev, isEnabled: checked }))
              }
            />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-2 sm:justify-end mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createGroup.isPending || updateGroup.isPending}
            className="w-full sm:w-auto"
          >
            {(createGroup.isPending || updateGroup.isPending) && (
              <Loader2 className="mr-1 size-4 animate-spin" />
            )}
            {editingGroup ? "更新" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}