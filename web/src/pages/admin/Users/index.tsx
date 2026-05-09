/**
 * 用户管理页面
 * 从 API 获取用户列表，支持搜索筛选、角色修改、启用/禁用、创建、编辑、删除和批量操作
 */

import { Plus, Users as UsersIcon } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import type { AdminUser } from "@/features/admin/users/types";
import { BatchActionsBar } from "./components/BatchActionsBar";
import { CreateUserDialog } from "./components/CreateUserDialog";
import { EditUserDialog } from "./components/EditUserDialog";
import type { CreateUserRequest, EditFormData } from "./components/types";
import { defaultCreateForm } from "./components/types";
import {
  BatchRoleConfirmDialog,
  BatchStatusConfirmDialog,
  DeleteConfirmDialog,
  RoleConfirmDialog,
  StatusConfirmDialog,
} from "./components/UserConfirmDialogs";
import { UserFiltersBar } from "./components/UserFiltersBar";
import { UsersTable } from "./components/UsersTable";
import { UsersTableSkeleton } from "./components/UsersTableSkeleton";
import { useUsersPage } from "./hooks/useUsersPage";

export default function Users() {
  const {
    // 角色
    roleConfigs,
    roleFilterOptions,
    getRoleLabel,
    // 筛选
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    // 分页
    page,
    setPage,
    limit,
    total,
    // 数据
    users,
    isLoading,
    error,
    refetch,
    // 选择
    selectedIds,
    allSelected,
    toggleSelectAll,
    toggleSelectOne,
    clearSelection,
    // mutations
    createUser,
    updateUser,
    deleteUser,
    batchUpdateStatus,
    batchUpdateRole,
    // handlers
    handleCreateUser,
    handleUpdateUser,
    handleDeleteUser,
    handleRoleChange,
    handleToggleStatus,
    handleBatchStatus,
    handleBatchRole,
  } = useUsersPage();

  // 弹窗状态（页面级管理）
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] =
    useState<CreateUserRequest>(defaultCreateForm);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    id: "",
    username: "",
    email: "",
    role: "user",
    is_active: true,
    email_verified: false,
    bio: "",
  });

  // 认弹窗状态
  const [statusConfirm, setStatusConfirm] = useState<{
    open: boolean;
    userId: string;
    userName: string;
    newStatus: boolean;
  }>({ open: false, userId: "", userName: "", newStatus: false });
  const [roleConfirm, setRoleConfirm] = useState<{
    open: boolean;
    userId: string;
    userName: string;
    currentRole: string;
    newRole: string;
  }>({ open: false, userId: "", userName: "", currentRole: "", newRole: "" });
  const [batchStatusConfirm, setBatchStatusConfirm] = useState<{
    open: boolean;
    is_active: boolean;
  }>({ open: false, is_active: false });
  const [batchRoleConfirm, setBatchRoleConfirm] = useState<{
    open: boolean;
    role: string;
  }>({ open: false, role: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    userId: string;
    userName: string;
  }>({ open: false, userId: "", userName: "" });

  // 打开创建弹窗
  const openCreateDialog = () => {
    setCreateForm(defaultCreateForm);
    setCreateOpen(true);
  };

  // 打开编辑弹窗
  const openEditDialog = (user: AdminUser) => {
    setEditForm({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      email_verified: user.email_verified,
      bio: "",
    });
    setEditOpen(true);
  };

  // 角色修改确认
  const onRoleChange = (
    userId: string,
    userName: string,
    currentRole: string,
    newRole: string,
  ) => {
    setRoleConfirm({ open: true, userId, userName, currentRole, newRole });
  };
  const confirmRoleChange = () => {
    handleRoleChange(roleConfirm.userId, roleConfirm.newRole);
    setRoleConfirm({
      open: false,
      userId: "",
      userName: "",
      currentRole: "",
      newRole: "",
    });
  };

  // 状态切换确认
  const onToggleStatus = (
    userId: string,
    userName: string,
    currentActive: boolean,
  ) => {
    setStatusConfirm({
      open: true,
      userId,
      userName,
      newStatus: !currentActive,
    });
  };
  const confirmToggleStatus = () => {
    handleToggleStatus(statusConfirm.userId, statusConfirm.newStatus);
    setStatusConfirm({
      open: false,
      userId: "",
      userName: "",
      newStatus: false,
    });
    clearSelection();
  };

  // 批量状态操作
  const onBatchAction = (is_active: boolean) => {
    setBatchStatusConfirm({ open: true, is_active });
  };
  const confirmBatchAction = () => {
    handleBatchStatus(Array.from(selectedIds), batchStatusConfirm.is_active);
    setBatchStatusConfirm({ open: false, is_active: false });
    clearSelection();
  };

  // 批量角色修改
  const onBatchRoleChange = (role: string) => {
    setBatchRoleConfirm({ open: true, role });
  };
  const confirmBatchRoleChange = () => {
    handleBatchRole(Array.from(selectedIds), batchRoleConfirm.role);
    setBatchRoleConfirm({ open: false, role: "" });
    clearSelection();
  };

  // 删除确认
  const onDeleteUser = (userId: string, userName: string) => {
    setDeleteConfirm({ open: true, userId, userName });
  };
  const confirmDeleteUser = () => {
    handleDeleteUser(deleteConfirm.userId);
    setDeleteConfirm({ open: false, userId: "", userName: "" });
    clearSelection();
  };

  // 创建提交
  const onSubmitCreate = () => {
    const success = handleCreateUser(createForm);
    if (success) setCreateOpen(false);
  };

  // 编辑提交
  const onSubmitEdit = () => {
    const success = handleUpdateUser(editForm);
    if (success) setEditOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="text-muted-foreground">管理注册用户和权限</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          新增用户
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <UserFiltersBar
        search={search}
        onSearchChange={setSearch}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        roleFilterOptions={roleFilterOptions}
      />

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <BatchActionsBar
          selectedCount={selectedIds.size}
          isBatchStatusPending={batchUpdateStatus.isPending}
          batchActivating={batchStatusConfirm.is_active}
          onBatchEnable={() => onBatchAction(true)}
          onBatchDisable={() => onBatchAction(false)}
          onBatchRoleChange={onBatchRoleChange}
          onClearSelection={clearSelection}
          roleConfigs={roleConfigs}
        />
      )}

      {isLoading && <UsersTableSkeleton />}
      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

      {!isLoading && !error && users.length === 0 && (
        <EmptyState
          title="暂无用户数据"
          description={
            search || roleFilter || statusFilter
              ? "没有找到符合条件的用户，请调整筛选条件"
              : "当前没有注册用户，或用户管理 API 尚未开放"
          }
          icon={<UsersIcon className="size-12" />}
        />
      )}

      {/* 用户列表表格 */}
      {!isLoading && !error && users.length > 0 && (
        <>
          <UsersTable
            users={users}
            allSelected={allSelected}
            selectedIds={selectedIds}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelectOne={toggleSelectOne}
            onRoleChange={onRoleChange}
            onToggleStatus={onToggleStatus}
            onEdit={openEditDialog}
            onDelete={onDeleteUser}
            roleConfigs={roleConfigs}
          />

          {/* 统计信息和分页 */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              共 {total} 个用户
            </div>
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / limit)}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      {/* ========== 弹窗 ========== */}

      {/* 创建用户弹窗 */}
      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={createForm}
        onFormChange={setCreateForm}
        onSubmit={onSubmitCreate}
        isPending={createUser.isPending}
        roleConfigs={roleConfigs}
      />

      {/* 编辑用户弹窗 */}
      <EditUserDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        form={editForm}
        onFormChange={setEditForm}
        onSubmit={onSubmitEdit}
        isPending={updateUser.isPending}
        roleConfigs={roleConfigs}
      />

      {/* 确认切换状态弹窗 */}
      <StatusConfirmDialog
        open={statusConfirm.open}
        userName={statusConfirm.userName}
        newStatus={statusConfirm.newStatus}
        onClose={() =>
          setStatusConfirm({
            open: false,
            userId: "",
            userName: "",
            newStatus: false,
          })
        }
        onConfirm={confirmToggleStatus}
      />

      {/* 批量操作确认弹窗 */}
      <BatchStatusConfirmDialog
        open={batchStatusConfirm.open}
        isActivating={batchStatusConfirm.is_active}
        selectedCount={selectedIds.size}
        onClose={() => setBatchStatusConfirm({ open: false, is_active: false })}
        onConfirm={confirmBatchAction}
      />

      {/* 批量修改角色确认弹窗 */}
      <BatchRoleConfirmDialog
        open={batchRoleConfirm.open}
        role={batchRoleConfirm.role}
        selectedCount={selectedIds.size}
        isLoading={batchUpdateRole.isPending}
        onClose={() => setBatchRoleConfirm({ open: false, role: "" })}
        onConfirm={confirmBatchRoleChange}
        getRoleLabel={getRoleLabel}
      />

      {/* 角色修改确认弹窗 */}
      <RoleConfirmDialog
        open={roleConfirm.open}
        userName={roleConfirm.userName}
        currentRole={roleConfirm.currentRole}
        newRole={roleConfirm.newRole}
        onClose={() =>
          setRoleConfirm({
            open: false,
            userId: "",
            userName: "",
            currentRole: "",
            newRole: "",
          })
        }
        onConfirm={confirmRoleChange}
        getRoleLabel={getRoleLabel}
      />

      {/* 删除确认弹窗 */}
      <DeleteConfirmDialog
        open={deleteConfirm.open}
        userName={deleteConfirm.userName}
        isLoading={deleteUser.isPending}
        onClose={() =>
          setDeleteConfirm({ open: false, userId: "", userName: "" })
        }
        onConfirm={confirmDeleteUser}
      />
    </div>
  );
}
