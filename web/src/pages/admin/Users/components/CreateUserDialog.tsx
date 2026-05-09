/**
 * 创建用户弹窗
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
import type { RoleConfig } from "@/features/admin/users";
import type { CreateUserRequest } from "./types";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CreateUserRequest;
  onFormChange: (form: CreateUserRequest) => void;
  onSubmit: () => void;
  isPending: boolean;
  roleConfigs: RoleConfig[];
}

export function CreateUserDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  isPending,
  roleConfigs,
}: CreateUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增用户</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>用户名</Label>
            <Input
              placeholder="请输入用户名"
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
              placeholder="请输入邮箱"
              value={form.email}
              onChange={(e) => onFormChange({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>密码</Label>
            <Input
              type="password"
              placeholder="至少 6 个字符"
              value={form.password}
              onChange={(e) =>
                onFormChange({ ...form, password: e.target.value })
              }
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
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.is_active}
              onCheckedChange={(checked) =>
                onFormChange({ ...form, is_active: !!checked })
              }
            />
            <Label>启用用户</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
