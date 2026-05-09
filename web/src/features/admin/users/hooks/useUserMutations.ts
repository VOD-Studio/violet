/**
 * 用户操作 hooks
 * 封装创建、编辑、删除、角色修改、状态切换等操作
 */

import { useCallback } from "react";
import {
  useBatchUpdateUserRole,
  useBatchUpdateUserStatus,
  useCreateUser,
  useDeleteUser,
  useToggleUserStatus,
  useUpdateUser,
  useUpdateUserRole,
} from "@/features/admin/users";
import { getRoleLabel } from "../api/roles";
import type { CreateUserRequest, EditFormData, RoleFromApi } from "../types";
import {
  handleMutationError,
  handleMutationSuccess,
} from "../utils/errorHandling";
import {
  validateCreateUserForm,
  validateEditUserForm,
} from "../utils/validation";

/** useUserMutations 返回值 */
export interface UseUserMutationsReturn {
  // mutations
  createUser: ReturnType<typeof useCreateUser>;
  updateUser: ReturnType<typeof useUpdateUser>;
  deleteUser: ReturnType<typeof useDeleteUser>;
  updateRole: ReturnType<typeof useUpdateUserRole>;
  toggleStatus: ReturnType<typeof useToggleUserStatus>;
  batchUpdateStatus: ReturnType<typeof useBatchUpdateUserStatus>;
  batchUpdateRole: ReturnType<typeof useBatchUpdateUserRole>;
  // handlers
  handleCreateUser: (form: CreateUserRequest) => boolean;
  handleUpdateUser: (form: EditFormData) => boolean;
  handleDeleteUser: (userId: string) => void;
  handleRoleChange: (userId: string, role: string) => void;
  handleToggleStatus: (userId: string, is_active: boolean) => void;
  handleBatchStatus: (userIds: string[], is_active: boolean) => void;
  handleBatchRole: (userIds: string[], role: string) => void;
}

/**
 * 用户操作 mutations hook
 * @param roles - 角色列表，用于显示角色标签
 */
export function useUserMutations(
  roles: RoleFromApi[] = [],
): UseUserMutationsReturn {
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const updateRole = useUpdateUserRole();
  const toggleStatus = useToggleUserStatus();
  const batchUpdateStatus = useBatchUpdateUserStatus();
  const batchUpdateRole = useBatchUpdateUserRole();

  const handleCreateUser = useCallback(
    (form: CreateUserRequest) => {
      const validation = validateCreateUserForm(form);
      if (!validation.valid) {
        const firstError = Object.values(validation.errors)[0];
        handleMutationError({ message: firstError }, "请填写完整信息");
        return false;
      }
      createUser.mutate(form, {
        onSuccess: () => handleMutationSuccess("用户创建成功"),
        onError: (err) => handleMutationError(err, "创建用户失败"),
      });
      return true;
    },
    [createUser],
  );

  const handleUpdateUser = useCallback(
    (form: EditFormData) => {
      const validation = validateEditUserForm(form);
      if (!validation.valid) {
        const firstError = Object.values(validation.errors)[0];
        handleMutationError({ message: firstError }, "请填写完整信息");
        return false;
      }
      const { id, ...data } = form;
      updateUser.mutate(
        { id, ...data },
        {
          onSuccess: () => handleMutationSuccess("用户信息更新成功"),
          onError: (err) => handleMutationError(err, "更新失败"),
        },
      );
      return true;
    },
    [updateUser],
  );

  const handleDeleteUser = useCallback(
    (userId: string) => {
      deleteUser.mutate(userId, {
        onSuccess: () => handleMutationSuccess("用户已删除"),
        onError: (err) => handleMutationError(err, "删除失败"),
      });
    },
    [deleteUser],
  );

  const handleRoleChange = useCallback(
    (userId: string, role: string) => {
      updateRole.mutate(
        { id: userId, role },
        {
          onSuccess: () => handleMutationSuccess("角色修改成功"),
          onError: (err) => handleMutationError(err, "角色修改失败"),
        },
      );
    },
    [updateRole],
  );

  const handleToggleStatus = useCallback(
    (userId: string, is_active: boolean) => {
      toggleStatus.mutate(
        { id: userId, is_active },
        {
          onSuccess: () =>
            handleMutationSuccess(is_active ? "用户已启用" : "用户已禁用"),
          onError: (err) => handleMutationError(err, "操作失败"),
        },
      );
    },
    [toggleStatus],
  );

  const handleBatchStatus = useCallback(
    (userIds: string[], is_active: boolean) => {
      batchUpdateStatus.mutate(
        { user_ids: userIds, is_active },
        {
          onSuccess: () =>
            handleMutationSuccess(
              is_active
                ? `已启用 ${userIds.length} 个用户`
                : `已禁用 ${userIds.length} 个用户`,
            ),
          onError: (err) => handleMutationError(err, "批量操作失败"),
        },
      );
    },
    [batchUpdateStatus],
  );

  const handleBatchRole = useCallback(
    (userIds: string[], role: string) => {
      batchUpdateRole.mutate(
        { user_ids: userIds, role },
        {
          onSuccess: () =>
            handleMutationSuccess(
              `已将 ${userIds.length} 个用户的角色修改为「${getRoleLabel(role, roles)}」`,
            ),
          onError: (err) => handleMutationError(err, "批量修改角色失败"),
        },
      );
    },
    [batchUpdateRole, roles],
  );

  return {
    createUser,
    updateUser,
    deleteUser,
    updateRole,
    toggleStatus,
    batchUpdateStatus,
    batchUpdateRole,
    handleCreateUser,
    handleUpdateUser,
    handleDeleteUser,
    handleRoleChange,
    handleToggleStatus,
    handleBatchStatus,
    handleBatchRole,
  };
}
