// 角色表单弹窗状态管理

import { useState } from "react";
import type { Role } from "../types";

interface RoleDialogState {
  open: boolean;
  mode: "create" | "edit";
  role?: Role;
}

export function useRoleForm() {
  const [dialog, setDialog] = useState<RoleDialogState>({
    open: false,
    mode: "create",
  });
  const [form, setForm] = useState({ name: "", description: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    role?: Role;
  }>({ open: false });

  const openCreate = () => {
    setForm({ name: "", description: "" });
    setDialog({ open: true, mode: "create" });
  };

  const openEdit = (role: Role) => {
    setForm({ name: role.name, description: role.description || "" });
    setDialog({ open: true, mode: "edit", role });
  };

  const closeDialog = () => setDialog((prev) => ({ ...prev, open: false }));

  const openDelete = (role: Role) => setDeleteConfirm({ open: true, role });
  const closeDelete = () => setDeleteConfirm({ open: false });

  return {
    dialog,
    form,
    setForm,
    deleteConfirm,
    openCreate,
    openEdit,
    closeDialog,
    openDelete,
    closeDelete,
  };
}
