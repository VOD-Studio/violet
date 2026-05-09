/**
 * 用户列表表格
 * 展示用户数据，支持行内角色修改和操作按钮
 */

import { CheckCircle2, Pencil, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RoleConfig } from "@/features/admin/users";
import type { AdminUser } from "./types";

interface UsersTableProps {
  users: AdminUser[];
  allSelected: boolean;
  selectedIds: Set<string>;
  onToggleSelectAll: () => void;
  onToggleSelectOne: (userId: string) => void;
  onRoleChange: (
    userId: string,
    userName: string,
    currentRole: string,
    newRole: string,
  ) => void;
  onToggleStatus: (
    userId: string,
    userName: string,
    currentActive: boolean,
  ) => void;
  onEdit: (user: AdminUser) => void;
  onDelete: (userId: string, userName: string) => void;
  roleConfigs: RoleConfig[];
}

export function UsersTable({
  users,
  allSelected,
  selectedIds,
  onToggleSelectAll,
  onToggleSelectOne,
  onRoleChange,
  onToggleStatus,
  onEdit,
  onDelete,
  roleConfigs,
}: UsersTableProps) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleSelectAll}
              />
            </TableHead>
            <TableHead>用户名</TableHead>
            <TableHead>邮箱</TableHead>
            <TableHead>邮箱验证</TableHead>
            <TableHead>角色</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>注册时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user: AdminUser) => (
            <TableRow key={user.id}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(user.id)}
                  onCheckedChange={() => onToggleSelectOne(user.id)}
                />
              </TableCell>
              <TableCell className="font-medium">{user.username}</TableCell>
              <TableCell className="text-muted-foreground">
                {user.email}
              </TableCell>
              <TableCell>
                {user.email_verified ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </TableCell>
              <TableCell>
                <Select
                  value={user.role}
                  onValueChange={(value) =>
                    value &&
                    value !== user.role &&
                    onRoleChange(user.id, user.username, user.role, value)
                  }
                >
                  <SelectTrigger className="w-24">
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
              </TableCell>
              <TableCell>
                <Badge variant={user.is_active ? "default" : "secondary"}>
                  {user.is_active ? "启用" : "禁用"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(user.created_at).toLocaleDateString("zh-CN")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(user)}
                    title="编辑"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={user.is_active ? "destructive" : "default"}
                    size="sm"
                    onClick={() =>
                      onToggleStatus(user.id, user.username, user.is_active)
                    }
                  >
                    {user.is_active ? "禁用" : "启用"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(user.id, user.username)}
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
