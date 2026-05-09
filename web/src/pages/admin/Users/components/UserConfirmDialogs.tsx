/**
 * 用户管理确认弹窗集合
 * 包含：状态切换确认、批量状态确认、批量角色确认、单个角色确认、删除确认
 */

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface StatusConfirmDialogProps {
  open: boolean;
  userName: string;
  newStatus: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** 确认切换状态弹窗 */
export function StatusConfirmDialog({
  open,
  userName,
  newStatus,
  onClose,
  onConfirm,
}: StatusConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={newStatus ? "启用用户" : "禁用用户"}
      description={
        newStatus
          ? `确定要启用用户「${userName}」吗？`
          : `确定要禁用用户「${userName}」吗？禁用后该用户将无法登录。`
      }
      confirmLabel={newStatus ? "启用" : "禁用"}
      destructive={!newStatus}
    />
  );
}

interface BatchStatusConfirmDialogProps {
  open: boolean;
  isActivating: boolean;
  selectedCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

/** 批量操作确认弹窗 */
export function BatchStatusConfirmDialog({
  open,
  isActivating,
  selectedCount,
  onClose,
  onConfirm,
}: BatchStatusConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={isActivating ? "批量启用用户" : "批量禁用用户"}
      description={
        isActivating
          ? `确定要启用选中的 ${selectedCount} 个用户吗？`
          : `确定要禁用选中的 ${selectedCount} 个用户吗？禁用后这些用户将无法登录。`
      }
      confirmLabel={isActivating ? "启用" : "禁用"}
      destructive={!isActivating}
    />
  );
}

interface BatchRoleConfirmDialogProps {
  open: boolean;
  role: string;
  selectedCount: number;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  getRoleLabel: (role: string) => string;
}

/** 批量修改角色确认弹窗 */
export function BatchRoleConfirmDialog({
  open,
  role,
  selectedCount,
  isLoading,
  onClose,
  onConfirm,
  getRoleLabel,
}: BatchRoleConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="批量修改角色"
      description={`确定要将选中的 ${selectedCount} 个用户的角色修改为「${getRoleLabel(role)}」吗？此操作可能会影响这些用户的权限。`}
      confirmLabel="确认修改"
      destructive={role === "user"}
      isLoading={isLoading}
    />
  );
}

interface RoleConfirmDialogProps {
  open: boolean;
  userName: string;
  currentRole: string;
  newRole: string;
  onClose: () => void;
  onConfirm: () => void;
  getRoleLabel: (role: string) => string;
}

/** 角色修改确认弹窗 */
export function RoleConfirmDialog({
  open,
  userName,
  currentRole,
  newRole,
  onClose,
  onConfirm,
  getRoleLabel,
}: RoleConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="修改用户角色"
      description={
        currentRole === "superadmin" || currentRole === "admin"
          ? `确定要将用户「${userName}」从「${getRoleLabel(currentRole)}」降级为「${getRoleLabel(newRole)}」吗？此操作可能会影响该用户的权限。`
          : `确定要将用户「${userName}」的角色修改为「${getRoleLabel(newRole)}」吗？`
      }
      confirmLabel="确认修改"
      destructive={currentRole === "superadmin" || currentRole === "admin"}
    />
  );
}

interface DeleteConfirmDialogProps {
  open: boolean;
  userName: string;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** 删除确认弹窗 */
export function DeleteConfirmDialog({
  open,
  userName,
  isLoading,
  onClose,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="删除用户"
      description={`确定要删除用户「${userName}」吗？此操作不可撤销，该用户的所有数据将被永久删除。`}
      confirmLabel="删除"
      destructive
      isLoading={isLoading}
    />
  );
}
