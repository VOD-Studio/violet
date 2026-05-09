import type {
  AdminUser,
  CreateUserRequest,
  EditFormData,
  UpdateUserRequest,
} from "@/features/admin/users/types";

/** 默认创建用户表单 */
export const defaultCreateForm: CreateUserRequest = {
  username: "",
  email: "",
  password: "",
  role: "user",
  is_active: true,
};

/** 默认编辑用户表单 */
export const defaultEditForm: EditFormData = {
  id: "",
  username: "",
  email: "",
  role: "user",
  is_active: true,
  email_verified: false,
  bio: "",
};

export type { AdminUser, CreateUserRequest, EditFormData, UpdateUserRequest };
