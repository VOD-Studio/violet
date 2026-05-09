/**
 * 批量操作栏
 * 显示已选择数量和批量启用/禁用/修改角色按钮
 */

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RoleConfig } from "@/features/admin/users";

interface BatchActionsBarProps {
  selectedCount: number;
  isBatchStatusPending: boolean;
  batchActivating: boolean;
  onBatchEnable: () => void;
  onBatchDisable: () => void;
  onBatchRoleChange: (role: string) => void;
  onClearSelection: () => void;
  roleConfigs: RoleConfig[];
}

export function BatchActionsBar({
  selectedCount,
  isBatchStatusPending,
  batchActivating,
  onBatchEnable,
  onBatchDisable,
  onBatchRoleChange,
  onClearSelection,
  roleConfigs,
}: BatchActionsBarProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
      <span className="text-sm text-muted-foreground">
        已选择 {selectedCount} 个用户
      </span>
      <Button
        size="sm"
        variant="default"
        onClick={onBatchEnable}
        disabled={isBatchStatusPending}
      >
        {isBatchStatusPending && batchActivating && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        批量启用
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={onBatchDisable}
        disabled={isBatchStatusPending}
      >
        {isBatchStatusPending && !batchActivating && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        批量禁用
      </Button>
      <Select
        value=""
        onValueChange={(value) => value && onBatchRoleChange(value)}
      >
        <SelectTrigger className="w-32 h-8">
          <SelectValue placeholder="修改角色" />
        </SelectTrigger>
        <SelectContent>
          {roleConfigs.map((role) => (
            <SelectItem key={role.value} value={role.value}>
              {role.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" onClick={onClearSelection}>
        取消选择
      </Button>
    </div>
  );
}
