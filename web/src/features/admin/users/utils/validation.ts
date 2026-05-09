import type { CreateUserRequest, EditFormData } from "../types";

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/** 验证用户名 */
function validateUsername(username: string): string | null {
  if (!username || username.trim() === "") {
    return "用户名不能为空";
  }
  if (username.length < 3) {
    return "用户名长度不能少于3个字符";
  }
  if (username.length > 20) {
    return "用户名长度不能超过20个字符";
  }
  return null;
}

/** 验证邮箱 */
function validateEmail(email: string): string | null {
  if (!email || email.trim() === "") {
    return "邮箱不能为空";
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "邮箱格式不正确";
  }
  return null;
}

/** 验证密码 */
function validatePassword(
  password: string,
  isRequired: boolean,
): string | null {
  if (!password || password.trim() === "") {
    if (isRequired) {
      return "密码不能为空";
    }
    return null;
  }
  if (password.length < 6) {
    return "密码长度不能少于6个字符";
  }
  return null;
}

/** 验证创建用户表单 */
export function validateCreateUserForm(
  form: CreateUserRequest,
): ValidationResult {
  const errors: Record<string, string> = {};

  const usernameError = validateUsername(form.username);
  if (usernameError) {
    errors.username = usernameError;
  }

  const emailError = validateEmail(form.email);
  if (emailError) {
    errors.email = emailError;
  }

  const passwordError = validatePassword(form.password, true);
  if (passwordError) {
    errors.password = passwordError;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/** 验证编辑用户表单 */
export function validateEditUserForm(form: EditFormData): ValidationResult {
  const errors: Record<string, string> = {};

  const usernameError = validateUsername(form.username);
  if (usernameError) {
    errors.username = usernameError;
  }

  const emailError = validateEmail(form.email);
  if (emailError) {
    errors.email = emailError;
  }

  // 编辑时密码是可选的，不验证

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
