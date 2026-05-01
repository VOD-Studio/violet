import { useState } from "react";
import type {
  StickerGroup,
  StickerGroupFormData,
} from "@/hooks/useStickersAdmin";
import {
  useCreateStickerGroup,
  useUpdateStickerGroup,
} from "@/hooks/useStickersAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import StickerUploader from "@/components/admin/StickerUploader";
import type { UploadResult } from "@/components/upload/ChunkedUpload";
import { getUploadUrl } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface StickerGroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGroup: StickerGroup | null;
  groupCount: number;
}

export function StickerGroupFormDialog({
  open,
  onOpenChange,
  editingGroup,
  groupCount,
}: StickerGroupFormDialogProps) {
  const createGroup = useCreateStickerGroup();
  const updateGroup = useUpdateStickerGroup();

  const [form, setForm] = useState<StickerGroupFormData>({
    name: "",
    slug: "",
    icon: "",
    description: "",
    sort: 0,
    is_hot: false,
    is_active: true,
  });

  // 当打开弹窗时，初始化表单
  useState(() => {
    if (open) {
      if (editingGroup) {
        setForm({
          name: editingGroup.name,
          slug: editingGroup.slug,
          icon: editingGroup.icon || "",
          description: editingGroup.description || "",
          sort: editingGroup.sort,
          is_hot: editingGroup.is_hot,
          is_active: editingGroup.is_active,
        });
      } else {
        setForm({
          name: "",
          slug: "",
          icon: "",
          description: "",
          sort: groupCount,
          is_hot: false,
          is_active: true,
        });
      }
    }
  });

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("请输入组名称");
      return;
    }

    const slug =
      form.slug?.trim() ||
      form.name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-一-龥]/g, "");

    const data: StickerGroupFormData = {
      name: form.name.trim(),
      slug,
      icon: form.icon?.trim() || undefined,
      description: form.description?.trim() || undefined,
      sort: form.sort,
      is_hot: form.is_hot,
      is_active: form.is_active,
    };

    if (editingGroup) {
      updateGroup.mutate(
        { id: editingGroup.id, data },
        {
          onSuccess: () => {
            toast.success("组已更新");
            onOpenChange(false);
          },
          onError: () => toast.error("更新失败"),
        },
      );
    } else {
      createGroup.mutate(data, {
        onSuccess: () => {
          toast.success("组已创建");
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
            {editingGroup ? "编辑表情包组" : "创建表情包组"}
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
            <label className="text-sm font-medium">Slug（可选）</label>
            <Input
              value={form.slug}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, slug: e.target.value }))
              }
              placeholder="如：classic"
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="text-sm font-medium">图标（可选）</label>
            <div className="mt-1.5">
              {form.icon && (
                <img
                  src={getUploadUrl(form.icon)}
                  alt="图标预览"
                  className="h-10 w-10 rounded object-cover mb-2"
                />
              )}
              <StickerUploader
                onUpload={(result: UploadResult) => {
                  setForm((prev) => ({ ...prev, icon: result.url }));
                  toast.success("图标上传成功");
                }}
                maxFiles={1}
                accept={{
                  "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
                }}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">描述（可选）</label>
            <Input
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="组的简介"
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">热门推荐</label>
            <Switch
              checked={form.is_hot}
              onCheckedChange={(checked: boolean) =>
                setForm((prev) => ({ ...prev, is_hot: checked }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">启用状态</label>
            <Switch
              checked={form.is_active}
              onCheckedChange={(checked: boolean) =>
                setForm((prev) => ({ ...prev, is_active: checked }))
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
