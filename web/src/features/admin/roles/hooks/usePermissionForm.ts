// 权限表单弹窗状态管理

import { useState } from "react";
import type { Permission } from "../types";

export function usePermissionForm() {
  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ code: "", name: "" });

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    permission?: Permission;
  }>({ open: false });
  const [editForm, setEditForm] = useState({ name: "" });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    permission?: Permission;
  }>({ open: false });

  const openCreate = () => {
    setCreateForm({ code: "", name: "" });
    setCreateDialog(true);
  };

  const closeCreate = () => setCreateDialog(false);

  const openEdit = (permission: Permission) => {
    setEditForm({ name: permission.name });
    setEditDialog({ open: true, permission });
  };

  const closeEdit = () => setEditDialog((prev) => ({ open: false, permission: prev.permission }));

  const openDelete = (permission: Permission) =>
    setDeleteConfirm({ open: true, permission });
  const closeDelete = () => setDeleteConfirm({ open: false });

  return {
    createDialog,
    createForm,
    setCreateForm,
    openCreate,
    closeCreate,
    editDialog,
    editForm,
    setEditForm,
    openEdit,
    closeEdit,
    deleteConfirm,
    openDelete,
    closeDelete,
  };
}
