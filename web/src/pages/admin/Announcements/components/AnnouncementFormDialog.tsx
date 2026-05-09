/**
 * 创建/编辑公告弹窗
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { typeColors } from "./constants";

export interface AnnouncementFormData {
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  is_active: boolean;
}

interface AnnouncementFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  form: AnnouncementFormData;
  onFormChange: (form: AnnouncementFormData) => void;
  onSubmit: () => void;
  onClose: () => void;
  isPending: boolean;
}

export function AnnouncementFormDialog({
  open,
  mode,
  form,
  onFormChange,
  onSubmit,
  onClose,
  isPending,
}: AnnouncementFormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
    >
      <DialogContent className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "创建公告" : "编辑公告"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "输入公告信息来创建新公告"
              : "修改公告信息"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) =>
                onFormChange({ ...form, title: e.target.value })
              }
              placeholder="请输入公告标题"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">内容</Label>
            <Textarea
              id="content"
              value={form.content}
              onChange={(e) =>
                onFormChange({ ...form, content: e.target.value })
              }
              placeholder="请输入公告内容"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">类型</Label>
            <Select
              value={form.type}
              onValueChange={(value) =>
                onFormChange({
                  ...form,
                  type: value as "info" | "warning" | "success" | "error",
                })
              }
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={typeColors.info}>
                      信息
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="warning">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={typeColors.warning}>
                      警告
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="success">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={typeColors.success}>
                      成功
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="error">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={typeColors.error}>
                      错误
                    </Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) =>
                onFormChange({ ...form, is_active: e.target.checked })
              }
              className="size-4 accent-primary"
            />
            <Label htmlFor="is_active">启用公告</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!form.title.trim() || !form.content.trim() || isPending}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {mode === "create" ? "创建" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
