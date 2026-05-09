/**
 * 编辑用户弹窗
 */

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { RoleConfig } from "@/features/admin/users";
import type { EditFormData } from "./types";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: EditFormData;
  onFormChange: (form: EditFormData) => void;
  onSubmit: () => void;
  isPending: boolean;
  roleConfigs: RoleConfig[];
}

export function EditUserDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  isPending,
  roleConfigs,
}: EditUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑用户</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>用户名</Label>
            <Input
              value={form.username}
              onChange={(e) =>
                onFormChange({ ...form, username: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>邮箱</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => onFormChange({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>角色</Label>
            <Select
              value={form.role}
              onValueChange={(value) => onFormChange({ ...form, role: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleConfigs.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>简介</Label>
            <Textarea
              placeholder="用户简介（可选）"
              value={form.bio}
              onChange={(e) => onFormChange({ ...form, bio: e.target.value })}
              rows={3}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  onFormChange({ ...form, is_active: !!checked })
                }
              />
              <Label>启用</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.email_verified}
                onCheckedChange={(checked) =>
                  onFormChange({ ...form, email_verified: !!checked })
                }
              />
              <Label>邮箱已验证</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
