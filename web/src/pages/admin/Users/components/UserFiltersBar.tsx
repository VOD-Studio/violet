/**
 * 用户搜索和筛选工具栏
 */

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RoleConfig } from "@/features/admin/users";
import { statusOptions } from "@/features/admin/users";

interface UserFiltersBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  roleFilterOptions: RoleConfig[];
}

export function UserFiltersBar({
  search,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  roleFilterOptions,
}: UserFiltersBarProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="relative flex-1 min-w-200">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索用户名或邮箱..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <Select
        value={roleFilter}
        onValueChange={(value) => onRoleFilterChange(value ?? "all")}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="全部角色" />
        </SelectTrigger>
        <SelectContent>
          {roleFilterOptions.map((role) => (
            <SelectItem key={role.value} value={role.value}>
              {role.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={statusFilter}
        onValueChange={(value) => onStatusFilterChange(value ?? "all")}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="全部状态" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              {status.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
