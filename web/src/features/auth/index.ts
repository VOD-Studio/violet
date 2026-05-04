/**
 * 认证功能模块公开 API
 */

// 组件
export { LoginForm } from "./components/LoginForm";
export { RegisterForm } from "./components/RegisterForm";
export { VerifyEmailForm } from "./components/VerifyEmailForm";

// Hooks
export { useAuth, useUpdateProfile, useChangePassword } from "./hooks/useAuth";

// Types
export type {
  LoginFormData,
  RegisterFormData,
  LoginResponse,
  UserInfo,
  UpdateProfileData,
  UpdatePasswordData,
} from "./types";
